"""
CloudCleaner Multi-Cloud FinOps API
====================================
FastAPI backend supporting AWS S3, Azure Blob Storage, and Google Cloud Storage
storage-waste auditing and remediation.

Provider selection via ?provider=all|aws|azure|gcp query parameter.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import settings
from providers.aws   import AWSProvider
from providers.azure import AzureProvider
from providers.gcp   import GCPProvider
from slack_service   import send_slack_notification, get_audit_logs
from ai_service      import generate_finops_executive_summary, answer_finops_query

# ── App bootstrap ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="CloudCleaner Multi-Cloud FinOps API",
    description=(
        "Multi-cloud storage waste auditor covering AWS S3, "
        "Azure Blob Storage, and Google Cloud Storage."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic request schemas ───────────────────────────────────────────────────

ProviderLiteral = Literal["aws", "azure", "gcp"]

class RemediateRequest(BaseModel):
    provider: ProviderLiteral
    bucket: str
    upload_id: str
    dry_run: bool = False

class AbortRequest(BaseModel):
    """Legacy bulk-abort schema (AWS only, kept for backward compat)."""
    bucket_name: str
    upload_ids: List[str]
    dry_run: bool = False
    use_mock: bool = True
    provider: ProviderLiteral = "aws"

class LifecyclePolicyRequest(BaseModel):
    bucket_name: str
    days: int = Field(default=7, ge=1, le=365)
    dry_run: bool = False
    use_mock: bool = True
    provider: ProviderLiteral = "aws"

class SlackNotifyRequest(BaseModel):
    title: str
    message: str
    bucket_name: Optional[str] = None
    reclaimed_gb: Optional[float] = None
    reclaimed_cost: Optional[float] = None
    webhook_url: Optional[str] = None

class AiQueryRequest(BaseModel):
    query: str
    scan_data: Optional[Dict[str, Any]] = None

class AiSummaryRequest(BaseModel):
    scan_data: Optional[Dict[str, Any]] = None


# ── Provider factory ───────────────────────────────────────────────────────────

def _make_aws(use_mock: bool, aws_key: str = "", aws_secret: str = "", region: str = "us-east-1") -> AWSProvider:
    return AWSProvider(
        use_mock=use_mock or not aws_key or not aws_secret,
        aws_access_key=aws_key,
        aws_secret_key=aws_secret,
        region=region,
    )

def _make_azure(use_mock: bool, connection_string: str = "") -> AzureProvider:
    return AzureProvider(use_mock=use_mock or not connection_string, connection_string=connection_string)

def _make_gcp(use_mock: bool, sa_json: str = "", project_id: str = "") -> GCPProvider:
    return GCPProvider(use_mock=use_mock or not sa_json, service_account_json=sa_json, project_id=project_id)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _aggregate_buckets(buckets: list[dict]) -> dict[str, Any]:
    """Build a cross-provider summary from a flat list of bucket dicts."""
    total_wasted_cost  = 0.0
    total_wasted_gb    = 0.0
    total_abandoned    = 0
    total_warning      = 0
    total_active       = 0
    total_safety_flags = 0

    for b in buckets:
        total_wasted_cost  += b.get("wasted_cost_monthly", 0)
        total_wasted_gb    += b.get("wasted_gb", 0)
        total_safety_flags += b.get("active_safety_flags", 0)
        for u in b.get("uploads", []):
            s = u.get("status", "")
            if s == "Abandoned":
                total_abandoned += 1
            elif s == "Warning":
                total_warning += 1
            elif s == "Active":
                total_active += 1

    return {
        "total_wasted_cost_monthly":  round(total_wasted_cost, 2),
        "total_wasted_gb":            round(total_wasted_gb, 2),
        "scanned_buckets_count":      len(buckets),
        "active_safety_flags":        total_safety_flags,
        "total_abandoned_uploads":    total_abandoned,
        "total_warning_uploads":      total_warning,
        "total_active_uploads":       total_active,
        "yearly_potential_savings":   round(total_wasted_cost * 12, 2),
    }


def _run_audit(
    provider: str,
    use_mock: bool,
    aws_key: str,
    aws_secret: str,
    region: str,
    azure_conn: str,
    gcp_sa_json: str,
    gcp_project: str,
) -> dict[str, Any]:
    buckets: list[dict] = []

    if provider in ("all", "aws"):
        aws = _make_aws(use_mock, aws_key, aws_secret, region)
        buckets.extend(aws.scan_stale_uploads())

    if provider in ("all", "azure"):
        az = _make_azure(use_mock, azure_conn)
        buckets.extend(az.scan_stale_uploads())

    if provider in ("all", "gcp"):
        gcp = _make_gcp(use_mock, gcp_sa_json, gcp_project)
        buckets.extend(gcp.scan_stale_uploads())

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "provider":  provider,
        "summary":   _aggregate_buckets(buckets),
        "buckets":   buckets,
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {
        "status":             "healthy",
        "service":            "CloudCleaner Multi-Cloud FinOps API",
        "version":            "2.0.0",
        "supported_providers":["aws", "azure", "gcp"],
        "mock_mode":          settings.USE_MOCK,
        "openai_configured":  bool(settings.OPENAI_API_KEY),
        "slack_configured":   bool(settings.SLACK_WEBHOOK_URL),
    }


@app.get("/api/audit")
def api_audit(
    provider: str = Query("all", description="Provider filter: all | aws | azure | gcp"),
    use_mock: bool = Query(True),
    aws_access_key:   str = Query(""),
    aws_secret_key:   str = Query(""),
    region:           str = Query("us-east-1"),
    azure_conn_str:   str = Query(""),
    gcp_sa_json_path: str = Query(""),
    gcp_project_id:   str = Query(""),
):
    """
    GET /api/audit?provider=all|aws|azure|gcp
    Returns combined or provider-filtered storage waste audit.
    """
    if provider not in ("all", "aws", "azure", "gcp"):
        raise HTTPException(status_code=400, detail=f"Invalid provider '{provider}'. Use all|aws|azure|gcp.")
    try:
        return _run_audit(
            provider, use_mock,
            aws_access_key, aws_secret_key, region,
            azure_conn_str, gcp_sa_json_path, gcp_project_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Legacy scan endpoint – kept for backward compat with existing frontend
@app.get("/api/audit/scan")
def api_audit_scan(
    use_mock: bool = Query(True),
    aws_access_key: str = Query(""),
    aws_secret_key: str = Query(""),
    region: str = Query("us-east-1"),
    provider: str = Query("all"),
):
    """Alias of /api/audit for backward compatibility."""
    try:
        return _run_audit(
            provider, use_mock,
            aws_access_key, aws_secret_key, region,
            "", "", "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/remediate")
def api_remediate(payload: RemediateRequest):
    """
    POST /api/remediate
    Body: { "provider": "aws|azure|gcp", "bucket": "...", "upload_id": "...", "dry_run": false }
    Triggers provider-specific upload cancellation + lifecycle policy injection.
    """
    try:
        success = False
        if payload.provider == "aws":
            p = _make_aws(settings.USE_MOCK)
            if not payload.dry_run:
                success = p.remediate_upload(payload.bucket, payload.upload_id)
            else:
                success = True  # dry-run always succeeds
        elif payload.provider == "azure":
            p = _make_azure(settings.USE_MOCK)
            if not payload.dry_run:
                success = p.remediate_upload(payload.bucket, payload.upload_id)
            else:
                success = True
        elif payload.provider == "gcp":
            p = _make_gcp(settings.USE_MOCK)
            if not payload.dry_run:
                success = p.remediate_upload(payload.bucket, payload.upload_id)
            else:
                success = True
        else:
            raise HTTPException(status_code=400, detail="Unknown provider")

        return {
            "success":   success,
            "dry_run":   payload.dry_run,
            "provider":  payload.provider,
            "bucket":    payload.bucket,
            "upload_id": payload.upload_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message":   (
                f"[{'DRY-RUN' if payload.dry_run else 'LIVE'}] "
                f"{'Remediation simulated' if payload.dry_run else ('Success' if success else 'Failed')} "
                f"for {payload.provider.upper()} upload {payload.upload_id} in {payload.bucket}."
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Legacy endpoints (kept for existing frontend compatibility) ────────────────

@app.post("/api/remediation/abort")
def api_abort_uploads(payload: AbortRequest):
    try:
        provider_inst: AWSProvider | AzureProvider | GCPProvider
        if payload.provider == "aws":
            provider_inst = _make_aws(payload.use_mock)
        elif payload.provider == "azure":
            provider_inst = _make_azure(payload.use_mock)
        else:
            provider_inst = _make_gcp(payload.use_mock)

        return provider_inst.abort_uploads_bulk(
            payload.bucket_name, payload.upload_ids, payload.dry_run
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/remediation/inject-lifecycle-policy")
def api_inject_lifecycle_policy(payload: LifecyclePolicyRequest):
    try:
        if payload.provider == "aws":
            p = _make_aws(payload.use_mock)
        elif payload.provider == "azure":
            p = _make_azure(payload.use_mock)
        else:
            p = _make_gcp(payload.use_mock)

        return p.inject_lifecycle_policy(payload.bucket_name, payload.days, payload.dry_run)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/remediation/slack-notify")
async def api_slack_notify(payload: SlackNotifyRequest):
    try:
        return await send_slack_notification(
            title=payload.title,
            message=payload.message,
            bucket_name=payload.bucket_name,
            reclaimed_gb=payload.reclaimed_gb,
            reclaimed_cost=payload.reclaimed_cost,
            webhook_url=payload.webhook_url or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/summary")
def api_ai_summary(payload: AiSummaryRequest):
    try:
        data = payload.scan_data or _run_audit("all", True, "", "", "us-east-1", "", "", "")
        return generate_finops_executive_summary(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/query")
def api_ai_query(payload: AiQueryRequest):
    try:
        data = payload.scan_data or _run_audit("all", True, "", "", "us-east-1", "", "", "")
        return answer_finops_query(payload.query, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/logs")
def api_get_logs(limit: int = Query(50, ge=1, le=200)):
    return {"logs": get_audit_logs(limit=limit)}

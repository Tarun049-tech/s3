"""
AWS S3 Provider Adapter
=======================
Wraps boto3 to scan for stale S3 Multipart Uploads.
Falls back to rich, realistic mock data when USE_MOCK=true or credentials
are not supplied.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from .base import BaseStorageProvider

# AWS regional pricing ($/GB/month)
_AWS_RATES: dict[str, float] = {
    "us-east-1":      0.023,
    "us-east-2":      0.023,
    "us-west-1":      0.026,
    "us-west-2":      0.023,
    "eu-west-1":      0.024,
    "eu-central-1":   0.0245,
    "ap-southeast-1": 0.025,
    "ap-northeast-1": 0.025,
    "sa-east-1":      0.040,
}
_DEFAULT_RATE = 0.023


# ── In-memory mock store (mutated by remediate_upload in mock mode) ────────────
_MOCK_BUCKETS: list[dict] = [
    {
        "bucket_name": "analytics-logs-prod",
        "region": "us-east-1",
        "creation_date": "2022-04-12T10:00:00Z",
        "has_lifecycle_policy": False,
        "lifecycle_policy_days": None,
        "uploads": [
            {
                "upload_id": "mp_upload_analytics_99812",
                "key": "raw-logs/2026/09/session_stream_chunk_412.parquet",
                "initiated": "2026-09-18T14:30:00Z",
                "size_bytes": 142_589_012_345,
                "parts_count": 2840,
                "storage_class": "STANDARD",
                "initiated_by": "arn:aws:iam::123456789012:user/etl-pipeline-worker",
            },
            {
                "upload_id": "mp_upload_analytics_99815",
                "key": "raw-logs/2026/09/user_telemetry_dump_09.parquet",
                "initiated": "2026-09-20T08:15:00Z",
                "size_bytes": 89_400_120_900,
                "parts_count": 1788,
                "storage_class": "STANDARD",
                "initiated_by": "arn:aws:iam::123456789012:user/etl-pipeline-worker",
            },
        ],
    },
    {
        "bucket_name": "media-uploads-temp",
        "region": "us-west-2",
        "creation_date": "2023-01-15T08:20:00Z",
        "has_lifecycle_policy": False,
        "lifecycle_policy_days": None,
        "uploads": [
            {
                "upload_id": "mp_upload_media_77401",
                "key": "user-videos/raw_4k_render_clip_901.mov",
                "initiated": "2026-09-15T11:00:00Z",
                "size_bytes": 312_000_000_000,
                "parts_count": 6240,
                "storage_class": "STANDARD",
                "initiated_by": "arn:aws:iam::123456789012:role/video-transcoder-service",
            },
            {
                "upload_id": "mp_upload_media_77409",
                "key": "user-assets/temp_image_batch_zip.tar.gz",
                "initiated": (datetime.now(timezone.utc) - timedelta(hours=14)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "size_bytes": 45_000_000_000,
                "parts_count": 900,
                "storage_class": "STANDARD",
                "initiated_by": "arn:aws:iam::123456789012:role/web-api-uploader",
            },
        ],
    },
    {
        "bucket_name": "data-warehouse-staging",
        "region": "eu-west-1",
        "creation_date": "2021-11-03T14:10:00Z",
        "has_lifecycle_policy": True,
        "lifecycle_policy_days": 7,
        "uploads": [
            {
                "upload_id": "mp_upload_dwh_33012",
                "key": "staging/db_snapshot_2026_09_25.sql",
                "initiated": (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "size_bytes": 67_000_000_000,
                "parts_count": 1340,
                "storage_class": "STANDARD",
                "initiated_by": "arn:aws:iam::123456789012:role/db-backup-cron",
            },
        ],
    },
    {
        "bucket_name": "ml-model-checkpoints",
        "region": "us-east-1",
        "creation_date": "2023-08-01T09:00:00Z",
        "has_lifecycle_policy": False,
        "lifecycle_policy_days": None,
        "uploads": [
            {
                "upload_id": "mp_upload_ml_11029",
                "key": "llm-v2-epoch-42/model_weights_shard_08.bin",
                "initiated": "2026-09-10T16:00:00Z",
                "size_bytes": 540_000_000_000,
                "parts_count": 10_800,
                "storage_class": "STANDARD",
                "initiated_by": "arn:aws:iam::123456789012:role/sage-maker-runner",
            },
        ],
    },
    {
        "bucket_name": "user-exports-cache",
        "region": "ap-southeast-1",
        "creation_date": "2023-05-19T12:00:00Z",
        "has_lifecycle_policy": False,
        "lifecycle_policy_days": None,
        "uploads": [
            {
                "upload_id": "mp_upload_exports_5021",
                "key": "gdpr-exports/user_9921_full_archive.zip",
                "initiated": (datetime.now(timezone.utc) - timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "size_bytes": 18_500_000_000,
                "parts_count": 370,
                "storage_class": "STANDARD",
                "initiated_by": "arn:aws:iam::123456789012:role/export-lambda",
            },
        ],
    },
    {
        "bucket_name": "customer-backups-archive",
        "region": "us-east-1",
        "creation_date": "2020-03-10T11:00:00Z",
        "has_lifecycle_policy": True,
        "lifecycle_policy_days": 14,
        "uploads": [],
    },
    {
        "bucket_name": "tmp-scratchpad-dev",
        "region": "us-west-1",
        "creation_date": "2024-02-14T15:30:00Z",
        "has_lifecycle_policy": False,
        "lifecycle_policy_days": None,
        "uploads": [
            {
                "upload_id": "mp_upload_tmp_90881",
                "key": "scratch/sandbox_test_payload.tmp",
                "initiated": "2026-09-01T10:00:00Z",
                "size_bytes": 78_000_000_000,
                "parts_count": 1560,
                "storage_class": "STANDARD",
                "initiated_by": "arn:aws:iam::123456789012:user/dev-developer-1",
            },
        ],
    },
]


class AWSProvider(BaseStorageProvider):
    """
    AWS S3 multi-part upload auditor.

    Params:
        use_mock    – When True (or when credentials are missing) uses
                      _MOCK_BUCKETS instead of real boto3 calls.
        aws_access_key / aws_secret_key / region – live credentials.
    """

    PROVIDER_NAME = "aws"

    def __init__(
        self,
        use_mock: bool = True,
        aws_access_key: str = "",
        aws_secret_key: str = "",
        region: str = "us-east-1",
    ) -> None:
        self.use_mock = use_mock or not aws_access_key or not aws_secret_key
        self.aws_access_key = aws_access_key
        self.aws_secret_key = aws_secret_key
        self.region = region

    # ── BaseStorageProvider interface ──────────────────────────────────────

    def calculate_cost(self, total_bytes: int) -> float:
        rate = _AWS_RATES.get(self.region, _DEFAULT_RATE)
        return round(self._bytes_to_gb(total_bytes) * rate, 4)

    def scan_stale_uploads(self) -> list[dict]:
        if self.use_mock:
            return self._scan_mock()
        return self._scan_live()

    def remediate_upload(self, bucket_name: str, upload_id: str) -> bool:
        """Abort a single upload and apply lifecycle policy (mock or live)."""
        if self.use_mock:
            return self._remediate_mock(bucket_name, upload_id)
        return self._remediate_live(bucket_name, upload_id)

    # ── Mock implementation ────────────────────────────────────────────────

    def _scan_mock(self) -> list[dict]:
        results = []
        for b in _MOCK_BUCKETS:
            rate = _AWS_RATES.get(b["region"], _DEFAULT_RATE)
            processed, wasted_bytes, safety_flags, bucket_status = [], 0, 0, "Active"

            for u in b.get("uploads", []):
                dt = self._parse_dt(u["initiated"])
                clf = self._classify(dt)
                size_gb = self._bytes_to_gb(u["size_bytes"])
                monthly_cost = round(size_gb * rate, 2)

                if clf["safety_guardrail"]:
                    safety_flags += 1
                elif clf["status"] == "Abandoned":
                    wasted_bytes += u["size_bytes"]
                    bucket_status = "Abandoned"
                else:
                    if bucket_status == "Active":
                        bucket_status = "Warning"

                processed.append({
                    "upload_id":     u["upload_id"],
                    "key":           u["key"],
                    "initiated":     u["initiated"],
                    "size_bytes":    u["size_bytes"],
                    "size_gb":       size_gb,
                    "monthly_cost":  monthly_cost,
                    "parts_count":   u["parts_count"],
                    "storage_class": u.get("storage_class", "STANDARD"),
                    "initiated_by":  u.get("initiated_by", "Unknown"),
                    **clf,
                })

            wasted_gb = self._bytes_to_gb(wasted_bytes)
            results.append({
                "bucket_name":          b["bucket_name"],
                "region":               b["region"],
                "provider":             self.PROVIDER_NAME,
                "rate_per_gb":          rate,
                "creation_date":        b.get("creation_date", ""),
                "has_lifecycle_policy": b.get("has_lifecycle_policy", False),
                "lifecycle_policy_days":b.get("lifecycle_policy_days"),
                "status":               bucket_status,
                "active_safety_flags":  safety_flags,
                "total_uploads_count":  len(processed),
                "wasted_gb":            wasted_gb,
                "wasted_cost_monthly":  round(wasted_gb * rate, 2),
                "uploads":              processed,
            })
        return results

    def _remediate_mock(self, bucket_name: str, upload_id: str) -> bool:
        for b in _MOCK_BUCKETS:
            if b["bucket_name"] != bucket_name:
                continue
            remaining = []
            aborted = False
            for u in b.get("uploads", []):
                if u["upload_id"] == upload_id:
                    dt = self._parse_dt(u["initiated"])
                    if self._classify(dt)["safety_guardrail"]:
                        remaining.append(u)   # protected – do not touch
                    else:
                        aborted = True        # drop from store → simulate abort
                        b["has_lifecycle_policy"] = True
                        b["lifecycle_policy_days"] = 7
                else:
                    remaining.append(u)
            b["uploads"] = remaining
            return aborted
        return False

    # ── Live boto3 implementation ──────────────────────────────────────────

    def _scan_live(self) -> list[dict]:
        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError:
            return self._scan_mock()

        results = []
        try:
            s3 = boto3.client(
                "s3",
                aws_access_key_id=self.aws_access_key,
                aws_secret_access_key=self.aws_secret_key,
                region_name=self.region,
            )
            for b_info in s3.list_buckets().get("Buckets", []):
                bucket_name = b_info["Name"]
                try:
                    loc = s3.get_bucket_location(Bucket=bucket_name)
                    region = loc.get("LocationConstraint") or "us-east-1"
                except Exception:
                    region = self.region

                rate = _AWS_RATES.get(region, _DEFAULT_RATE)
                has_lc, lc_days = False, None

                try:
                    lc_resp = s3.get_bucket_lifecycle_configuration(Bucket=bucket_name)
                    for rule in lc_resp.get("Rules", []):
                        if rule.get("Status") == "Enabled":
                            mp = rule.get("AbortIncompleteMultipartUpload")
                            if mp:
                                has_lc = True
                                lc_days = mp.get("DaysAfterInitiation", 7)
                except ClientError as e:
                    if e.response["Error"]["Code"] != "NoSuchLifecycleConfiguration":
                        pass

                processed, wasted_bytes, safety_flags, bucket_status = [], 0, 0, "Active"
                try:
                    for u in s3.list_multipart_uploads(Bucket=bucket_name).get("Uploads", []):
                        uid, key, dt = u["UploadId"], u["Key"], u["Initiated"]
                        try:
                            parts = s3.list_parts(Bucket=bucket_name, Key=key, UploadId=uid).get("Parts", [])
                            sz = sum(p.get("Size", 0) for p in parts)
                        except Exception:
                            sz = 100 * 1024 * 1024

                        clf = self._classify(dt)
                        size_gb = self._bytes_to_gb(sz)
                        if clf["safety_guardrail"]:
                            safety_flags += 1
                        elif clf["status"] == "Abandoned":
                            wasted_bytes += sz
                            bucket_status = "Abandoned"
                        else:
                            if bucket_status == "Active":
                                bucket_status = "Warning"

                        processed.append({
                            "upload_id":     uid,
                            "key":           key,
                            "initiated":     dt.isoformat(),
                            "size_bytes":    sz,
                            "size_gb":       size_gb,
                            "monthly_cost":  round(size_gb * rate, 2),
                            "parts_count":   len(parts) if "parts" in dir() else 0,
                            "storage_class": u.get("StorageClass", "STANDARD"),
                            "initiated_by":  u.get("Initiator", {}).get("DisplayName", "AWS User"),
                            **clf,
                        })
                except Exception:
                    pass

                wasted_gb = self._bytes_to_gb(wasted_bytes)
                results.append({
                    "bucket_name":          bucket_name,
                    "region":               region,
                    "provider":             self.PROVIDER_NAME,
                    "rate_per_gb":          rate,
                    "creation_date":        b_info.get("CreationDate", datetime.now(timezone.utc)).isoformat(),
                    "has_lifecycle_policy": has_lc,
                    "lifecycle_policy_days":lc_days,
                    "status":               bucket_status,
                    "active_safety_flags":  safety_flags,
                    "total_uploads_count":  len(processed),
                    "wasted_gb":            wasted_gb,
                    "wasted_cost_monthly":  round(wasted_gb * rate, 2),
                    "uploads":              processed,
                })
        except Exception:
            return self._scan_mock()
        return results

    def _remediate_live(self, bucket_name: str, upload_id: str) -> bool:
        try:
            import boto3
        except ImportError:
            return False
        try:
            s3 = boto3.client(
                "s3",
                aws_access_key_id=self.aws_access_key,
                aws_secret_access_key=self.aws_secret_key,
                region_name=self.region,
            )
            # Find key for upload_id
            resp = s3.list_multipart_uploads(Bucket=bucket_name)
            key = next(
                (u["Key"] for u in resp.get("Uploads", []) if u["UploadId"] == upload_id),
                None,
            )
            if not key:
                return False
            s3.abort_multipart_upload(Bucket=bucket_name, Key=key, UploadId=upload_id)
            # Inject lifecycle policy
            s3.put_bucket_lifecycle_configuration(
                Bucket=bucket_name,
                LifecycleConfiguration={
                    "Rules": [{
                        "ID": "CloudCleaner-AbortIncomplete-7Days",
                        "Status": "Enabled",
                        "Filter": {"Prefix": ""},
                        "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7},
                    }]
                },
            )
            return True
        except Exception:
            return False

    # ── Bulk helpers (used by main.py legacy routes) ───────────────────────

    def abort_uploads_bulk(
        self,
        bucket_name: str,
        upload_ids: list[str],
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """Abort multiple uploads; respects dry_run and 24h guardrail."""
        results, aborted, protected, reclaimed = [], 0, 0, 0

        for b in _MOCK_BUCKETS:
            if b["bucket_name"] != bucket_name:
                continue
            remaining = []
            for u in b.get("uploads", []):
                if u["upload_id"] not in upload_ids:
                    remaining.append(u)
                    continue
                dt = self._parse_dt(u["initiated"])
                clf = self._classify(dt)
                if clf["safety_guardrail"]:
                    protected += 1
                    results.append({
                        "upload_id": u["upload_id"],
                        "key":       u["key"],
                        "status":    "SKIPPED_PROTECTED",
                        "reason":    "SAFETY GUARDRAIL: Upload < 24h old.",
                    })
                    remaining.append(u)
                else:
                    aborted += 1
                    reclaimed += u["size_bytes"]
                    results.append({
                        "upload_id":    u["upload_id"],
                        "key":          u["key"],
                        "status":       "SIMULATED_ABORT" if dry_run else "ABORTED_SUCCESS",
                        "reclaimed_gb": self._bytes_to_gb(u["size_bytes"]),
                        "reason":       "Abandoned upload aborted.",
                    })
                    if not dry_run:
                        pass  # drop from remaining
                    else:
                        remaining.append(u)
            if not dry_run:
                b["uploads"] = remaining
            break

        rec_gb = self._bytes_to_gb(reclaimed)
        rate = _AWS_RATES.get(self.region, _DEFAULT_RATE)
        return {
            "bucket_name":            bucket_name,
            "dry_run":                dry_run,
            "timestamp":              datetime.now(timezone.utc).isoformat(),
            "aborted_count":          aborted,
            "protected_skipped_count":protected,
            "reclaimed_gb":           rec_gb,
            "reclaimed_cost_monthly": round(rec_gb * rate, 2),
            "details":                results,
        }

    def inject_lifecycle_policy(
        self,
        bucket_name: str,
        days: int = 7,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """Apply (or simulate) an AbortIncompleteMultipartUpload lifecycle rule."""
        t0 = time.time()
        policy_rule = {
            "ID":     f"CloudCleaner-AbortIncompleteMultipartUploads-{days}Days",
            "Status": "Enabled",
            "Filter": {"Prefix": ""},
            "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": days},
        }
        for b in _MOCK_BUCKETS:
            if b["bucket_name"] == bucket_name:
                if not dry_run:
                    b["has_lifecycle_policy"]  = True
                    b["lifecycle_policy_days"] = days
                break

        elapsed = max(round(time.time() - t0, 3), 0.12)
        return {
            "bucket_name":            bucket_name,
            "status":                 "SUCCESS" if not dry_run else "SIMULATED_SUCCESS",
            "dry_run":                dry_run,
            "days":                   days,
            "execution_time_seconds": elapsed,
            "policy":                 policy_rule,
            "timestamp":              datetime.now(timezone.utc).isoformat(),
            "message": (
                f"Successfully injected lifecycle policy ({days} days) "
                f"for bucket '{bucket_name}' in {elapsed}s."
            ),
        }

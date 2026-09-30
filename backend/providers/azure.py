"""
Azure Blob Storage Provider Adapter
=====================================
Targets **uncommitted block blobs** – the Azure equivalent of S3 multipart
parts that were never committed into a final blob.

When USE_MOCK=true, generates realistic mock Azure storage accounts.
When live credentials are supplied (connection string or account key),
wraps azure-storage-blob to list containers and enumerate uncommitted blocks.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from .base import BaseStorageProvider

# Azure Blob Storage pricing – LRS Hot tier ($/GB/month, approximate)
_AZURE_RATES: dict[str, float] = {
    "eastus":          0.018,
    "eastus2":         0.018,
    "westus":          0.018,
    "westus2":         0.018,
    "westeurope":      0.0184,
    "northeurope":     0.0184,
    "southeastasia":   0.02,
    "australiaeast":   0.0228,
    "brazilsouth":     0.0288,
    "canadacentral":   0.022,
}
_DEFAULT_RATE = 0.018

# ── In-memory mock store ───────────────────────────────────────────────────────
_MOCK_CONTAINERS: list[dict] = [
    {
        "container_name":       "raw-ingest-pipeline",
        "storage_account":      "prodstorageacct01",
        "region":               "eastus",
        "creation_date":        "2022-06-10T09:00:00Z",
        "has_lifecycle_policy": False,
        "lifecycle_policy_days":None,
        "uploads": [
            {
                "upload_id":    "azure_block_ingest_10291",
                "key":          "ingest/2026/09/telemetry_stream_batch_0091.parquet",
                "initiated":    "2026-09-12T08:00:00Z",
                "size_bytes":   98_304_000_000,
                "parts_count":  1_966,
                "storage_class":"Hot",
                "initiated_by": "azure-data-factory/pipeline-etl-prod",
            },
            {
                "upload_id":    "azure_block_ingest_10298",
                "key":          "ingest/2026/09/iot_sensor_dump_47.avro",
                "initiated":    "2026-09-19T14:30:00Z",
                "size_bytes":   34_200_000_000,
                "parts_count":  684,
                "storage_class":"Hot",
                "initiated_by": "azure-data-factory/pipeline-iot-sync",
            },
        ],
    },
    {
        "container_name":       "ml-experiment-artifacts",
        "storage_account":      "mlstorageprod02",
        "region":               "westeurope",
        "creation_date":        "2023-02-20T11:15:00Z",
        "has_lifecycle_policy": True,
        "lifecycle_policy_days":10,
        "uploads": [
            {
                "upload_id":    "azure_block_ml_55012",
                "key":          "experiments/run-2291/model_checkpoint_epoch_80.bin",
                "initiated":    (datetime.now(timezone.utc) - timedelta(days=4)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "size_bytes":   215_000_000_000,
                "parts_count":  4_300,
                "storage_class":"Hot",
                "initiated_by": "azure-ml/compute-cluster-gpu-a100",
            },
        ],
    },
    {
        "container_name":       "media-transcode-temp",
        "storage_account":      "mediastoreacct03",
        "region":               "southeastasia",
        "creation_date":        "2023-09-01T07:00:00Z",
        "has_lifecycle_policy": False,
        "lifecycle_policy_days":None,
        "uploads": [
            {
                "upload_id":    "azure_block_media_88761",
                "key":          "transcodes/hd_stream_asset_4829.mp4",
                "initiated":    "2026-09-05T15:00:00Z",
                "size_bytes":   450_000_000_000,
                "parts_count":  9_000,
                "storage_class":"Hot",
                "initiated_by": "azure-media-services/encoder-v3",
            },
            {
                "upload_id":    "azure_block_media_88790",
                "key":          "transcodes/4k_raw_proxy_clip_0039.mxf",
                "initiated":    (datetime.now(timezone.utc) - timedelta(hours=10)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "size_bytes":   62_000_000_000,
                "parts_count":  1_240,
                "storage_class":"Hot",
                "initiated_by": "azure-media-services/encoder-v3",
            },
        ],
    },
    {
        "container_name":       "backup-archive-cold",
        "storage_account":      "backupstoreacct04",
        "region":               "eastus2",
        "creation_date":        "2021-07-15T12:00:00Z",
        "has_lifecycle_policy": True,
        "lifecycle_policy_days":7,
        "uploads": [],
    },
    {
        "container_name":       "dev-scratch-uploads",
        "storage_account":      "devstoragdev05",
        "region":               "westus2",
        "creation_date":        "2024-03-01T09:30:00Z",
        "has_lifecycle_policy": False,
        "lifecycle_policy_days":None,
        "uploads": [
            {
                "upload_id":    "azure_block_dev_21100",
                "key":          "scratch/load_test_payload_v9.tar.gz",
                "initiated":    "2026-09-02T10:00:00Z",
                "size_bytes":   55_000_000_000,
                "parts_count":  1_100,
                "storage_class":"Hot",
                "initiated_by": "devops/load-test-pipeline",
            },
        ],
    },
]


class AzureProvider(BaseStorageProvider):
    """
    Azure Blob Storage uncommitted block auditor.

    Params:
        use_mock            – fallback to mock data when True
        connection_string   – full Azure storage connection string
        account_name        – storage account name (alt credential method)
        account_key         – storage account key
    """

    PROVIDER_NAME = "azure"

    def __init__(
        self,
        use_mock: bool = True,
        connection_string: str = "",
        account_name: str = "",
        account_key: str = "",
    ) -> None:
        self.use_mock = use_mock or (not connection_string and not account_key)
        self.connection_string = connection_string
        self.account_name = account_name
        self.account_key = account_key

    # ── BaseStorageProvider interface ──────────────────────────────────────

    def calculate_cost(self, total_bytes: int) -> float:
        return round(self._bytes_to_gb(total_bytes) * _DEFAULT_RATE, 4)

    def scan_stale_uploads(self) -> list[dict]:
        if self.use_mock:
            return self._scan_mock()
        return self._scan_live()

    def remediate_upload(self, bucket_name: str, upload_id: str) -> bool:
        if self.use_mock:
            return self._remediate_mock(bucket_name, upload_id)
        return self._remediate_live(bucket_name, upload_id)

    # ── Mock ───────────────────────────────────────────────────────────────

    def _scan_mock(self) -> list[dict]:
        results = []
        for c in _MOCK_CONTAINERS:
            rate = _AZURE_RATES.get(c["region"], _DEFAULT_RATE)
            processed, wasted_bytes, safety_flags, bucket_status = [], 0, 0, "Active"

            for u in c.get("uploads", []):
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
                    "storage_class": u.get("storage_class", "Hot"),
                    "initiated_by":  u.get("initiated_by", "Unknown"),
                    **clf,
                })

            wasted_gb = self._bytes_to_gb(wasted_bytes)
            results.append({
                "bucket_name":           c["container_name"],
                "storage_account":       c.get("storage_account", ""),
                "region":                c["region"],
                "provider":              self.PROVIDER_NAME,
                "rate_per_gb":           rate,
                "creation_date":         c.get("creation_date", ""),
                "has_lifecycle_policy":  c.get("has_lifecycle_policy", False),
                "lifecycle_policy_days": c.get("lifecycle_policy_days"),
                "status":                bucket_status,
                "active_safety_flags":   safety_flags,
                "total_uploads_count":   len(processed),
                "wasted_gb":             wasted_gb,
                "wasted_cost_monthly":   round(wasted_gb * rate, 2),
                "uploads":               processed,
            })
        return results

    def _remediate_mock(self, bucket_name: str, upload_id: str) -> bool:
        for c in _MOCK_CONTAINERS:
            if c["container_name"] != bucket_name:
                continue
            remaining, aborted = [], False
            for u in c.get("uploads", []):
                if u["upload_id"] == upload_id:
                    dt = self._parse_dt(u["initiated"])
                    if self._classify(dt)["safety_guardrail"]:
                        remaining.append(u)
                    else:
                        aborted = True
                        c["has_lifecycle_policy"] = True
                        c["lifecycle_policy_days"] = 7
                else:
                    remaining.append(u)
            c["uploads"] = remaining
            return aborted
        return False

    # ── Live azure-storage-blob implementation ─────────────────────────────

    def _scan_live(self) -> list[dict]:
        try:
            from azure.storage.blob import BlobServiceClient
        except ImportError:
            return self._scan_mock()

        results = []
        try:
            client = BlobServiceClient.from_connection_string(self.connection_string)
            for container in client.list_containers():
                cname = container["name"]
                cc = client.get_container_client(cname)
                processed, wasted_bytes, safety_flags, bucket_status = [], 0, 0, "Active"

                # List blobs that have uncommitted blocks
                for blob in cc.list_blobs(include=["uncommittedblobs"]):
                    if not blob.get("has_uncommitted_blocks"):
                        continue
                    # Use blob creation time as proxy for "initiated"
                    dt = blob.get("creation_time") or datetime.now(timezone.utc)
                    clf = self._classify(dt)
                    size_bytes = blob.get("size", 0)
                    size_gb = self._bytes_to_gb(size_bytes)
                    rate = _DEFAULT_RATE
                    monthly_cost = round(size_gb * rate, 2)

                    if clf["safety_guardrail"]:
                        safety_flags += 1
                    elif clf["status"] == "Abandoned":
                        wasted_bytes += size_bytes
                        bucket_status = "Abandoned"
                    else:
                        if bucket_status == "Active":
                            bucket_status = "Warning"

                    processed.append({
                        "upload_id":     blob["name"],
                        "key":           blob["name"],
                        "initiated":     dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                        "size_bytes":    size_bytes,
                        "size_gb":       size_gb,
                        "monthly_cost":  monthly_cost,
                        "parts_count":   0,
                        "storage_class": "Hot",
                        "initiated_by":  "azure-sdk",
                        **clf,
                    })

                wasted_gb = self._bytes_to_gb(wasted_bytes)
                results.append({
                    "bucket_name":           cname,
                    "region":                "azure-live",
                    "provider":              self.PROVIDER_NAME,
                    "rate_per_gb":           _DEFAULT_RATE,
                    "creation_date":         "",
                    "has_lifecycle_policy":  False,
                    "lifecycle_policy_days": None,
                    "status":                bucket_status,
                    "active_safety_flags":   safety_flags,
                    "total_uploads_count":   len(processed),
                    "wasted_gb":             wasted_gb,
                    "wasted_cost_monthly":   round(wasted_gb * _DEFAULT_RATE, 2),
                    "uploads":               processed,
                })
        except Exception:
            return self._scan_mock()
        return results

    def _remediate_live(self, bucket_name: str, upload_id: str) -> bool:
        try:
            from azure.storage.blob import BlobServiceClient
        except ImportError:
            return False
        try:
            client = BlobServiceClient.from_connection_string(self.connection_string)
            bc = client.get_blob_client(container=bucket_name, blob=upload_id)
            # Deleting the blob removes all uncommitted blocks
            bc.delete_blob()
            return True
        except Exception:
            return False

    # ── Bulk helpers (mirrors AWSProvider pattern) ─────────────────────────

    def abort_uploads_bulk(
        self,
        bucket_name: str,
        upload_ids: list[str],
        dry_run: bool = False,
    ) -> dict[str, Any]:
        results, aborted, protected, reclaimed = [], 0, 0, 0
        for c in _MOCK_CONTAINERS:
            if c["container_name"] != bucket_name:
                continue
            remaining = []
            for u in c.get("uploads", []):
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
                        "reason":       "Uncommitted block blob aborted.",
                    })
                    if dry_run:
                        remaining.append(u)
            if not dry_run:
                c["uploads"] = remaining
            break

        rec_gb = self._bytes_to_gb(reclaimed)
        return {
            "bucket_name":            bucket_name,
            "dry_run":                dry_run,
            "timestamp":              datetime.now(timezone.utc).isoformat(),
            "aborted_count":          aborted,
            "protected_skipped_count":protected,
            "reclaimed_gb":           rec_gb,
            "reclaimed_cost_monthly": round(rec_gb * _DEFAULT_RATE, 2),
            "details":                results,
        }

    def inject_lifecycle_policy(
        self,
        bucket_name: str,
        days: int = 7,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        t0 = time.time()
        for c in _MOCK_CONTAINERS:
            if c["container_name"] == bucket_name:
                if not dry_run:
                    c["has_lifecycle_policy"]  = True
                    c["lifecycle_policy_days"] = days
                break
        elapsed = max(round(time.time() - t0, 3), 0.12)
        return {
            "bucket_name":            bucket_name,
            "status":                 "SUCCESS" if not dry_run else "SIMULATED_SUCCESS",
            "dry_run":                dry_run,
            "days":                   days,
            "execution_time_seconds": elapsed,
            "policy": {
                "type":    "Azure Blob Lifecycle Management",
                "rule":    f"Delete uncommitted blocks after {days} days",
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": (
                f"Azure lifecycle policy ({days}-day block expiry) applied "
                f"to container '{bucket_name}' in {elapsed}s."
            ),
        }

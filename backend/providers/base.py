"""
Abstract Base Class for all Multi-Cloud Storage Providers.

Every provider adapter (AWS, Azure, GCP) MUST implement:
  - scan_stale_uploads()  -> list[dict]
  - calculate_cost()      -> float
  - remediate_upload()    -> bool
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Any


# ── Shared classification thresholds ──────────────────────────────────────────
GUARDRAIL_HOURS = 24       # < 24 h  →  Active / Protected
ABANDONED_DAYS  = 7        # > 7 d   →  Abandoned / Stale


def classify_upload_status(initiated_dt: datetime) -> dict[str, Any]:
    """
    Universal upload-age classifier used by every provider.

    Returns a dict with:
      status, status_badge, safety_guardrail, can_abort,
      guardrail_reason, age_days, severity
    """
    now = datetime.now(timezone.utc)
    if initiated_dt.tzinfo is None:
        initiated_dt = initiated_dt.replace(tzinfo=timezone.utc)

    age_hours = (now - initiated_dt).total_seconds() / 3600.0
    age_days  = age_hours / 24.0

    if age_hours < GUARDRAIL_HOURS:
        return {
            "status":           "Active",
            "status_badge":     "Active (Protected)",
            "safety_guardrail": True,
            "can_abort":        False,
            "guardrail_reason": "Initiated within last 24 hours – protected by CloudCleaner Safety Policy",
            "age_days":         round(age_days, 2),
            "severity":         "info",
        }
    elif age_days <= ABANDONED_DAYS:
        return {
            "status":           "Warning",
            "status_badge":     "Warning (Aging)",
            "safety_guardrail": False,
            "can_abort":        True,
            "guardrail_reason": "Between 24 hours and 7 days old",
            "age_days":         round(age_days, 2),
            "severity":         "warning",
        }
    else:
        return {
            "status":           "Abandoned",
            "status_badge":     "Abandoned (Stale)",
            "safety_guardrail": False,
            "can_abort":        True,
            "guardrail_reason": "Older than 7 days – recommended for immediate cleanup",
            "age_days":         round(age_days, 2),
            "severity":         "danger",
        }


def parse_iso_datetime(dt_str: str) -> datetime:
    """Safely parse an ISO-8601 string to a timezone-aware datetime."""
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        # Fallback: treat as 10-day-old upload so it surfaces as Abandoned
        return datetime.now(timezone.utc) - timedelta(days=10)


# ── Abstract Provider Interface ────────────────────────────────────────────────

class BaseStorageProvider(ABC):
    """
    Contract that every cloud-storage provider adapter must satisfy.

    Subclasses inject their SDK clients / mock flags via __init__.
    The three abstract methods define the FinOps audit-remediation lifecycle.
    """

    # Human-readable cloud name (overridden by each adapter)
    PROVIDER_NAME: str = "unknown"

    @abstractmethod
    def scan_stale_uploads(self) -> list[dict]:
        """
        Scan all containers/buckets in this provider for stale upload sessions.

        Guardrails enforced here:
          • Skip uploads < 24 hours old  (Active / Protected)
          • Flag  uploads > 7 days  old  (Abandoned)
          • Flag  uploads 1-7 days  old  (Warning)

        Returns a list of bucket-level audit dicts, each containing:
          bucket_name, region, provider, rate_per_gb, creation_date,
          has_lifecycle_policy, lifecycle_policy_days, status,
          active_safety_flags, total_uploads_count, wasted_gb,
          wasted_cost_monthly, uploads[]
        """
        ...

    @abstractmethod
    def calculate_cost(self, total_bytes: int) -> float:
        """
        Calculate the estimated monthly storage cost for *total_bytes* of
        orphaned upload parts using the provider's blended rate.

        Args:
            total_bytes: Raw byte count of abandoned parts.

        Returns:
            Monthly cost in USD (float, rounded to 4 dp).
        """
        ...

    @abstractmethod
    def remediate_upload(self, bucket_name: str, upload_id: str) -> bool:
        """
        Abort the specified stale upload and apply a 7-day auto-prune
        lifecycle/retention rule to the container.

        Safety guardrail is enforced here too: if the upload is < 24 h old
        this method must return False without touching the data.

        Args:
            bucket_name: Container / bucket / storage-account name.
            upload_id:   Provider-specific upload / block / resumable session ID.

        Returns:
            True  if the upload was successfully aborted.
            False if skipped (guardrail) or failed.
        """
        ...

    # ── Shared helpers available to all subclasses ─────────────────────────

    @staticmethod
    def _classify(initiated_dt: datetime) -> dict[str, Any]:
        return classify_upload_status(initiated_dt)

    @staticmethod
    def _parse_dt(dt_str: str) -> datetime:
        return parse_iso_datetime(dt_str)

    @staticmethod
    def _bytes_to_gb(b: int) -> float:
        return round(b / (1024 ** 3), 2)

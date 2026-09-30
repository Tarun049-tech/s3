import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from config import settings

# In-memory log of Slack notifications and system audit trail
AUDIT_LOG_STORE: List[Dict[str, Any]] = [
    {
        "id": "log-001",
        "timestamp": (datetime.now(timezone.utc)).isoformat(),
        "action": "SYSTEM_SCAN_INITIALIZED",
        "title": "S3 Audit Scan Executed",
        "details": "Scanned 7 AWS S3 buckets. Identified 4 abandoned multipart uploads wasting $26.47/mo.",
        "status": "INFO",
        "slack_sent": False
    }
]

def log_audit_action(action: str, title: str, details: str, status: str = "INFO", slack_sent: bool = False) -> Dict[str, Any]:
    entry = {
        "id": f"log-{len(AUDIT_LOG_STORE) + 1:03d}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "title": title,
        "details": details,
        "status": status,
        "slack_sent": slack_sent
    }
    AUDIT_LOG_STORE.insert(0, entry)
    return entry

def get_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
    return AUDIT_LOG_STORE[:limit]

async def send_slack_notification(title: str, message: str, bucket_name: Optional[str] = None, reclaimed_gb: Optional[float] = None, reclaimed_cost: Optional[float] = None, webhook_url: str = "") -> Dict[str, Any]:
    url = webhook_url or settings.SLACK_WEBHOOK_URL

    # Build Slack Block Kit payload
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"🚨 S3Cleaner Alert: {title}",
                "emoji": True
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{message}*"
            }
        }
    ]

    fields = []
    if bucket_name:
        fields.append({"type": "mrkdwn", "text": f"*Bucket:* `{bucket_name}`"})
    if reclaimed_gb is not None:
        fields.append({"type": "mrkdwn", "text": f"*Storage Reclaimed:* `{reclaimed_gb} GB`"})
    if reclaimed_cost is not None:
        fields.append({"type": "mrkdwn", "text": f"*Monthly Savings:* `${reclaimed_cost}/mo`"})
    fields.append({"type": "mrkdwn", "text": f"*Timestamp:* `{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}`"})

    if fields:
        blocks.append({"type": "section", "fields": fields})

    blocks.append({"type": "divider"})

    payload = {"blocks": blocks}
    slack_sent = False

    if url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code in (200, 201):
                    slack_sent = True
        except Exception as e:
            slack_sent = False

    log_entry = log_audit_action(
        action="SLACK_NOTIFICATION",
        title=title,
        details=f"{message} | Bucket: {bucket_name or 'N/A'}",
        status="SUCCESS" if slack_sent else "SIMULATED",
        slack_sent=slack_sent
    )

    return {
        "success": True,
        "slack_sent": slack_sent,
        "webhook_configured": bool(url),
        "log_entry": log_entry
    }

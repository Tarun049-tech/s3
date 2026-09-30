import os
from typing import Dict, Any, List
from openai import OpenAI
from config import settings

def get_openai_client():
    key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
    if key:
        return OpenAI(api_key=key)
    return None

def generate_finops_executive_summary(scan_data: Dict[str, Any]) -> Dict[str, Any]:
    summary_stats = scan_data.get("summary", {})
    buckets = scan_data.get("buckets", [])

    total_cost = summary_stats.get("total_wasted_cost_monthly", 0.0)
    total_gb = summary_stats.get("total_wasted_gb", 0.0)
    yearly_savings = summary_stats.get("yearly_potential_savings", 0.0)
    safety_flags = summary_stats.get("active_safety_flags", 0)
    abandoned_count = summary_stats.get("total_abandoned_uploads", 0)

    # Identify top wasting buckets
    sorted_buckets = sorted(buckets, key=lambda b: b.get("wasted_cost_monthly", 0), reverse=True)
    top_wasting = [b for b in sorted_buckets if b.get("wasted_cost_monthly", 0) > 0]

    client = get_openai_client()

    if client:
        try:
            prompt = f"""
You are an expert AWS FinOps Architect and S3 Storage Specialist.
Review the following S3 Multipart Upload Audit Report:

- Total Monthly Wasted Spend: ${total_cost}/mo
- Total Storage Reclaimable: {total_gb} GB
- Yearly Potential Savings: ${yearly_savings}/yr
- Scanned Buckets: {summary_stats.get('scanned_buckets_count')}
- Active Safety Guardrail Flags (<24h protected): {safety_flags}
- Stale Abandoned Multipart Uploads (>7d): {abandoned_count}

Top Money-Wasting Buckets:
{[{'name': b['bucket_name'], 'region': b['region'], 'wasted_gb': b['wasted_gb'], 'wasted_cost': b['wasted_cost_monthly'], 'has_lifecycle': b['has_lifecycle_policy']} for b in top_wasting[:4]]}

Provide a concise, polished executive summary with 3 sections:
1. Executive Summary & Cost Impact
2. Critical Findings & Highest Risk Buckets
3. Recommended Immediate Action Plan (including Lifecycle Policy recommendations)
Format using clear markdown with emojis.
"""
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a senior Cloud FinOps advisor specializing in AWS storage cost optimization."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.4
            )
            ai_text = response.choices[0].message.content
            return {
                "source": "OpenAI GPT-4o",
                "summary_text": ai_text
            }
        except Exception as e:
            pass

    # Intelligent Fallback Summary Engine
    top_bucket_name = top_wasting[0]['bucket_name'] if top_wasting else "N/A"
    top_bucket_cost = top_wasting[0]['wasted_cost_monthly'] if top_wasting else 0.0
    top_bucket_gb = top_wasting[0]['wasted_gb'] if top_wasting else 0.0

    buckets_lacking_policy = [b['bucket_name'] for b in buckets if not b.get('has_lifecycle_policy')]

    fallback_text = f"""### 📊 Executive S3 FinOps Briefing

**Financial Overview**
- **Immediate Reclaimable Monthly Storage:** **{total_gb:,} GB**
- **Current Unnecessary Spend:** **${total_cost:.2f} / month** (${yearly_savings:.2f} / year)
- **Active Safety Guardrails:** **{safety_flags} upload(s)** initiated <24h ago are **strictly protected**.

---

### 🔍 Key Findings & Risk Hotspots
1. **Primary Waste Vector:** Bucket **`{top_bucket_name}`** is the highest contributor, abandoning **{top_bucket_gb} GB** and incurring **${top_bucket_cost:.2f}/mo** in orphaned multipart upload parts.
2. **Lifecycle Governance Gap:** **{len(buckets_lacking_policy)} of {len(buckets)} buckets** lack an automated `AbortIncompleteMultipartUpload` lifecycle rule.
3. **Safety Protection:** **{safety_flags} active upload(s)** are within the 24-hour safety window and will not be touched during bulk purges.

---

### 🛡️ Recommended Action Plan
- **Step 1:** Execute a **One-Click Abort** on all {abandoned_count} stale multipart uploads older than 7 days to immediately reclaim **${total_cost:.2f}/mo**.
- **Step 2:** Auto-inject `AbortIncompleteMultipartUpload` (7 Days) lifecycle policy across unconfigured buckets (**{', '.join(buckets_lacking_policy[:3])}**).
- **Step 3:** Enable Slack Webhook reporting to audit future orphaned upload build-ups automatically.
"""
    return {
        "source": "S3Cleaner FinOps Engine (Rule-based Fallback)",
        "summary_text": fallback_text
    }

def answer_finops_query(query: str, scan_data: Dict[str, Any]) -> Dict[str, Any]:
    summary_stats = scan_data.get("summary", {})
    buckets = scan_data.get("buckets", [])

    query_lower = query.lower().strip()
    client = get_openai_client()

    if client:
        try:
            prompt = f"""
Context: S3 Audit Data:
{scan_data}

User Question: "{query}"

Answer the user's question directly based on the provided AWS S3 audit scan data. Be concise, professional, clear, and action-oriented. Format with markdown.
"""
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are S3Cleaner AI FinOps Assistant. Provide helpful, precise answers about AWS S3 costs, multipart uploads, and lifecycle rules."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.3
            )
            return {
                "query": query,
                "answer": response.choices[0].message.content,
                "source": "OpenAI GPT-4o"
            }
        except Exception:
            pass

    # High quality pattern matching fallback responses
    sorted_buckets = sorted(buckets, key=lambda b: b.get("wasted_cost_monthly", 0), reverse=True)

    if "most" in query_lower and ("money" in query_lower or "cost" in query_lower or "waste" in query_lower):
        top = sorted_buckets[0] if sorted_buckets else None
        if top:
            ans = f"Bucket **`{top['bucket_name']}`** wastes the most money! It holds **{top['wasted_gb']} GB** of abandoned multipart uploads, costing **${top['wasted_cost_monthly']:.2f}/month** (${top['wasted_cost_monthly']*12:.2f}/year) at standard regional AWS rate (${top['s3_rate_per_gb']}/GB/mo)."
        else:
            ans = "No bucket is currently wasting money."
    elif "guardrail" in query_lower or "24 hour" in query_lower or "24h" in query_lower or "protect" in query_lower or "safety" in query_lower:
        ans = f"**Safety Guardrail Policy:** S3Cleaner strictly enforces a **24-hour protection window**. Any multipart upload initiated within the last 24 hours ({summary_stats.get('active_safety_flags', 0)} currently active) is **NEVER** aborted or deleted, even during bulk cleanups. This protects active data streams and ongoing ETL ingestions."
    elif "savings" in query_lower or "total" in query_lower or "reclaim" in query_lower or "how much" in query_lower:
        ans = f"By aborting all abandoned multipart uploads older than 7 days, you will immediately reclaim **{summary_stats.get('total_wasted_gb', 0)} GB** of S3 storage and save **${summary_stats.get('total_wasted_cost_monthly', 0):.2f}/month** (**${summary_stats.get('yearly_potential_savings', 0):.2f}/year**)."
    elif "lifecycle" in query_lower or "policy" in query_lower or "rule" in query_lower:
        no_lc = [b['bucket_name'] for b in buckets if not b.get('has_lifecycle_policy')]
        ans = f"Currently, **{len(no_lc)} buckets** lack an automatic `AbortIncompleteMultipartUpload` policy: **{', '.join(no_lc)}**. Injecting a 7-day lifecycle policy ensures AWS automatically purges orphaned multipart parts every 7 days, eliminating manual intervention."
    else:
        ans = f"**S3Cleaner Summary:** You currently have **{summary_stats.get('scanned_buckets_count', 0)} scanned buckets**, **{summary_stats.get('total_abandoned_uploads', 0)} abandoned multipart uploads**, wasting **{summary_stats.get('total_wasted_gb', 0)} GB** (${summary_stats.get('total_wasted_cost_monthly', 0):.2f}/mo). Click **'Inject Lifecycle Policy'** or **'Abort Abandoned'** to clean up immediately!"

    return {
        "query": query,
        "answer": ans,
        "source": "S3Cleaner FinOps Engine (Rule-based Fallback)"
    }

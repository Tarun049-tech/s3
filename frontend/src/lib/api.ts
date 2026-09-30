const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ── Provider type ──────────────────────────────────────────────────────────────
export type CloudProvider = "all" | "aws" | "azure" | "gcp";

// ── Shared upload shape (same across all providers) ────────────────────────────
export interface MultipartUpload {
  upload_id: string;
  key: string;
  initiated: string;
  size_bytes: number;
  size_gb: number;
  monthly_cost: number;
  parts_count: number;
  storage_class: string;
  initiated_by: string;
  status: "Active" | "Warning" | "Abandoned";
  status_badge: string;
  safety_guardrail: boolean;
  can_abort: boolean;
  guardrail_reason: string;
  age_days: number;
  severity: "info" | "warning" | "danger";
}

// ── Per-bucket/container audit entry ─────────────────────────────────────────
export interface BucketAudit {
  bucket_name: string;
  region: string;
  provider: CloudProvider;            // "aws" | "azure" | "gcp"
  rate_per_gb: number;
  creation_date: string;
  has_lifecycle_policy: boolean;
  lifecycle_policy_days: number | null;
  status: "Active" | "Warning" | "Abandoned";
  active_safety_flags: number;
  total_uploads_count: number;
  wasted_gb: number;
  wasted_cost_monthly: number;
  uploads: MultipartUpload[];
  // Azure-specific
  storage_account?: string;
  // GCP-specific
  project?: string;
}

// ── Cross-provider aggregate summary ─────────────────────────────────────────
export interface AuditSummary {
  total_wasted_cost_monthly: number;
  total_wasted_gb: number;
  scanned_buckets_count: number;
  active_safety_flags: number;
  total_abandoned_uploads: number;
  total_warning_uploads: number;
  total_active_uploads: number;
  yearly_potential_savings: number;
}

export interface ScanResponse {
  timestamp: string;
  provider: CloudProvider;
  summary: AuditSummary;
  buckets: BucketAudit[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  title: string;
  details: string;
  status: string;
  slack_sent: boolean;
}

// ── API call helpers ──────────────────────────────────────────────────────────

/** GET /api/audit – multi-cloud or single-provider audit */
export async function fetchAuditScan(
  useMock: boolean = true,
  provider: CloudProvider = "all",
  awsKey: string = "",
  awsSecret: string = "",
  region: string = "us-east-1",
  azureConnStr: string = "",
  gcpSaJsonPath: string = "",
  gcpProjectId: string = "",
): Promise<ScanResponse> {
  const params = new URLSearchParams({
    use_mock:           useMock.toString(),
    provider,
    aws_access_key:     awsKey,
    aws_secret_key:     awsSecret,
    region,
    azure_conn_str:     azureConnStr,
    gcp_sa_json_path:   gcpSaJsonPath,
    gcp_project_id:     gcpProjectId,
  });
  const res = await fetch(`${API_BASE_URL}/audit?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch multi-cloud audit scan");
  return res.json();
}

/** POST /api/remediate – single upload remediation */
export async function remediateUpload(
  provider: "aws" | "azure" | "gcp",
  bucket: string,
  uploadId: string,
  dryRun: boolean = false,
) {
  const res = await fetch(`${API_BASE_URL}/remediate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, bucket, upload_id: uploadId, dry_run: dryRun }),
  });
  if (!res.ok) throw new Error("Failed to remediate upload");
  return res.json();
}

/** POST /api/remediation/abort – bulk abort (legacy, provider-aware) */
export async function abortUploads(
  bucketName: string,
  uploadIds: string[],
  dryRun: boolean = false,
  useMock: boolean = true,
  provider: "aws" | "azure" | "gcp" = "aws",
) {
  const res = await fetch(`${API_BASE_URL}/remediation/abort`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      upload_ids:  uploadIds,
      dry_run:     dryRun,
      use_mock:    useMock,
      provider,
    }),
  });
  if (!res.ok) throw new Error("Failed to abort uploads");
  return res.json();
}

/** POST /api/remediation/inject-lifecycle-policy */
export async function injectLifecyclePolicy(
  bucketName: string,
  days: number = 7,
  dryRun: boolean = false,
  useMock: boolean = true,
  provider: "aws" | "azure" | "gcp" = "aws",
) {
  const res = await fetch(`${API_BASE_URL}/remediation/inject-lifecycle-policy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      days,
      dry_run:  dryRun,
      use_mock: useMock,
      provider,
    }),
  });
  if (!res.ok) throw new Error("Failed to inject lifecycle policy");
  return res.json();
}

/** POST /api/remediation/slack-notify */
export async function sendSlackNotify(
  title: string,
  message: string,
  bucketName?: string,
  reclaimedGb?: number,
  reclaimedCost?: number,
  webhookUrl?: string,
) {
  const res = await fetch(`${API_BASE_URL}/remediation/slack-notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      message,
      bucket_name:    bucketName,
      reclaimed_gb:   reclaimedGb,
      reclaimed_cost: reclaimedCost,
      webhook_url:    webhookUrl,
    }),
  });
  if (!res.ok) throw new Error("Failed to send Slack notification");
  return res.json();
}

/** POST /api/ai/summary */
export async function fetchAiSummary(scanData?: ScanResponse) {
  const res = await fetch(`${API_BASE_URL}/ai/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scan_data: scanData }),
  });
  if (!res.ok) throw new Error("Failed to fetch AI executive summary");
  return res.json();
}

/** POST /api/ai/query */
export async function fetchAiQuery(query: string, scanData?: ScanResponse) {
  const res = await fetch(`${API_BASE_URL}/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, scan_data: scanData }),
  });
  if (!res.ok) throw new Error("Failed to query AI FinOps assistant");
  return res.json();
}

/** GET /api/logs */
export async function fetchAuditLogs(): Promise<{ logs: AuditLogEntry[] }> {
  const res = await fetch(`${API_BASE_URL}/logs`);
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
}

// ── Provider display helpers ──────────────────────────────────────────────────

export const PROVIDER_META: Record<"aws" | "azure" | "gcp", {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}> = {
  aws: {
    label:       "AWS S3",
    color:       "text-orange-400",
    bgColor:     "bg-orange-950/60",
    borderColor: "border-orange-800/40",
    icon:        "☁️",
  },
  azure: {
    label:       "Azure Blob",
    color:       "text-blue-400",
    bgColor:     "bg-blue-950/60",
    borderColor: "border-blue-800/40",
    icon:        "🔷",
  },
  gcp: {
    label:       "GCP Storage",
    color:       "text-emerald-400",
    bgColor:     "bg-emerald-950/60",
    borderColor: "border-emerald-800/40",
    icon:        "🟢",
  },
};

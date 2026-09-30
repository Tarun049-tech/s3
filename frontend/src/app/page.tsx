"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { MetricCards } from "@/components/MetricCards";
import { BucketsTable } from "@/components/BucketsTable";
import { UploadDetailsModal } from "@/components/UploadDetailsModal";
import { LifecyclePolicyModal } from "@/components/LifecyclePolicyModal";
import { AiAssistant } from "@/components/AiAssistant";
import { AuditLogDrawer } from "@/components/AuditLogDrawer";
import { SettingsModal } from "@/components/SettingsModal";

import {
  CloudProvider,
  ScanResponse,
  BucketAudit,
  fetchAuditScan,
  abortUploads,
  injectLifecyclePolicy,
  sendSlackNotify,
} from "@/lib/api";
import { ShieldAlert, CheckCircle2, AlertTriangle, Zap, Send } from "lucide-react";

export default function Home() {
  // ── App Controls ─────────────────────────────────────────────────────────
  const [useMock, setUseMock]       = useState<boolean>(true);
  const [dryRun, setDryRun]         = useState<boolean>(true);
  const [activeProvider, setActiveProvider] = useState<CloudProvider>("all");
  const [activeTab, setActiveTab]   = useState<"dashboard" | "ai" | "logs">("dashboard");

  // ── AWS Credentials ───────────────────────────────────────────────────────
  const [awsKey, setAwsKey]         = useState<string>("");
  const [awsSecret, setAwsSecret]   = useState<string>("");
  const [region, setRegion]         = useState<string>("us-east-1");

  // ── Azure Credentials ─────────────────────────────────────────────────────
  const [azureConnStr, setAzureConnStr] = useState<string>("");

  // ── GCP Credentials ───────────────────────────────────────────────────────
  const [gcpSaJson, setGcpSaJson]     = useState<string>("");
  const [gcpProjectId, setGcpProjectId] = useState<string>("");

  // ── Slack ─────────────────────────────────────────────────────────────────
  const [slackWebhook, setSlackWebhook] = useState<string>("");

  // ── UI State ──────────────────────────────────────────────────────────────
  const [scanData, setScanData]         = useState<ScanResponse | null>(null);
  const [isScanning, setIsScanning]     = useState<boolean>(true);
  const [selectedBucketDetails, setSelectedBucketDetails] = useState<BucketAudit | null>(null);
  const [selectedLifecycleBucket, setSelectedLifecycleBucket] = useState<BucketAudit | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: "success" | "warning" | "info"; message: string } | null>(null);

  const showToast = (message: string, type: "success" | "warning" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => { handleScan(); }, [useMock, activeProvider, awsKey, awsSecret, region, azureConnStr, gcpSaJson, gcpProjectId]);

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = async () => {
    setIsScanning(true);
    try {
      const data = await fetchAuditScan(
        useMock, activeProvider,
        awsKey, awsSecret, region,
        azureConnStr, gcpSaJson, gcpProjectId,
      );
      setScanData(data);
    } catch (e: any) {
      showToast("Audit scan failed: " + e.message, "warning");
    } finally {
      setIsScanning(false);
    }
  };

  // ── Abort uploads ─────────────────────────────────────────────────────────
  const handleAbortUploads = async (bucketName: string, uploadIds: string[], provider?: string) => {
    try {
      const prov = (provider || "aws") as "aws" | "azure" | "gcp";
      const res = await abortUploads(bucketName, uploadIds, dryRun, useMock, prov);
      const msg = `Reclaimed ${res.reclaimed_gb} GB ($${res.reclaimed_cost_monthly}/mo) across ${res.aborted_count} upload(s).${
        res.protected_skipped_count > 0 ? ` (${res.protected_skipped_count} skipped – 24h Guardrail)` : ""
      }`;
      showToast(msg, dryRun ? "info" : "success");

      await sendSlackNotify(
        dryRun ? "SIMULATED Abort" : "Upload Aborted",
        msg, bucketName, res.reclaimed_gb, res.reclaimed_cost_monthly, slackWebhook
      );
      await handleScan();

      if (selectedBucketDetails?.bucket_name === bucketName) {
        const updated = scanData?.buckets.find((b) => b.bucket_name === bucketName) || null;
        setSelectedBucketDetails(updated);
      }
    } catch (e: any) {
      showToast("Error aborting uploads: " + e.message, "warning");
    }
  };

  // ── Lifecycle policy ──────────────────────────────────────────────────────
  const handleInjectLifecycle = async (bucketName: string, days: number, provider?: string) => {
    try {
      const prov = (provider || "aws") as "aws" | "azure" | "gcp";
      const res = await injectLifecyclePolicy(bucketName, days, dryRun, useMock, prov);
      showToast(res.message, dryRun ? "info" : "success");
      await sendSlackNotify(
        dryRun ? "SIMULATED Lifecycle Injection" : "Lifecycle Policy Injected",
        `Applied ${days}-day rule to '${bucketName}' in ${res.execution_time_seconds}s.`,
        bucketName, undefined, undefined, slackWebhook
      );
      await handleScan();
    } catch (e: any) {
      showToast("Error injecting lifecycle policy: " + e.message, "warning");
      throw e;
    }
  };

  // ── Slack test ────────────────────────────────────────────────────────────
  const handleTestSlack = async (overrideUrl?: string) => {
    try {
      await sendSlackNotify(
        "CloudCleaner Webhook Verification",
        "Multi-cloud FinOps audit & remediation alerts enabled.",
        "analytics-logs-prod", 142.59, 3.28,
        overrideUrl || slackWebhook
      );
      showToast("Slack notification dispatched!", "success");
    } catch (e: any) {
      showToast("Slack test failed: " + e.message, "warning");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-5 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-lg ${
            toast.type === "success"
              ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
              : toast.type === "info"
              ? "bg-cyan-950/90 border-cyan-700 text-cyan-200"
              : "bg-amber-950/90 border-amber-700 text-amber-200"
          }`}>
            {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {toast.type === "info"    && <Zap className="w-5 h-5 text-cyan-400" />}
            {toast.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Navbar */}
      <Navbar
        useMock={useMock}
        setUseMock={setUseMock}
        dryRun={dryRun}
        setDryRun={setDryRun}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProvider={activeProvider}
        setActiveProvider={setActiveProvider}
        onRefresh={handleScan}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTestSlack={() => handleTestSlack()}
        isScanning={isScanning}
      />

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 space-y-8">
        {scanData && <MetricCards summary={scanData.summary} />}

        {activeTab === "dashboard" && scanData && (
          <BucketsTable
            buckets={scanData.buckets}
            onOpenUploadDetails={(b) => setSelectedBucketDetails(b)}
            onOpenLifecycleModal={(b) => setSelectedLifecycleBucket(b)}
            onAbortBucket={(bucketName, uploadIds, provider) => handleAbortUploads(bucketName, uploadIds, provider)}
            dryRun={dryRun}
            isScanning={isScanning}
          />
        )}

        {activeTab === "ai" && <AiAssistant scanData={scanData} />}
        {activeTab === "logs" && <AuditLogDrawer />}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between px-4 lg:px-8 gap-2">
          <span>CloudCleaner Multi-Cloud FinOps &copy; 2026</span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
            24h Guardrail Safety Policy — AWS · Azure · GCP
          </span>
          <span>Next.js 14 &bull; FastAPI &bull; Boto3 &bull; Azure SDK &bull; GCS SDK</span>
        </div>
      </footer>

      {/* Modals */}
      <UploadDetailsModal
        bucket={selectedBucketDetails}
        onClose={() => setSelectedBucketDetails(null)}
        onAbortSingle={(bucketName, uploadId, provider) => handleAbortUploads(bucketName, [uploadId], provider)}
        dryRun={dryRun}
      />

      <LifecyclePolicyModal
        bucket={selectedLifecycleBucket}
        onClose={() => setSelectedLifecycleBucket(null)}
        onInject={(bucketName, days, provider) => handleInjectLifecycle(bucketName, days, provider)}
        dryRun={dryRun}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        awsKey={awsKey}           setAwsKey={setAwsKey}
        awsSecret={awsSecret}     setAwsSecret={setAwsSecret}
        region={region}           setRegion={setRegion}
        azureConnStr={azureConnStr}     setAzureConnStr={setAzureConnStr}
        gcpSaJson={gcpSaJson}           setGcpSaJson={setGcpSaJson}
        gcpProjectId={gcpProjectId}     setGcpProjectId={setGcpProjectId}
        slackWebhook={slackWebhook}     setSlackWebhook={setSlackWebhook}
        onTestSlack={(url) => handleTestSlack(url)}
      />
    </div>
  );
}

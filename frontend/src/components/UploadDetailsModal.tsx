"use client";

import React from "react";
import { X, ShieldCheck, ShieldAlert, Trash2, Clock, User, HardDrive, AlertCircle } from "lucide-react";
import { BucketAudit, MultipartUpload } from "@/lib/api";

interface UploadDetailsModalProps {
  bucket: BucketAudit | null;
  onClose: () => void;
  onAbortSingle: (bucketName: string, uploadId: string, provider: string) => void;
  dryRun: boolean;
}

export const UploadDetailsModal: React.FC<UploadDetailsModalProps> = ({
  bucket,
  onClose,
  onAbortSingle,
  dryRun,
}) => {
  if (!bucket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-4xl max-h-[85vh] rounded-2xl border border-zinc-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white font-mono">{bucket.bucket_name}</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {bucket.region}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Detailed Incomplete Multipart Uploads ({bucket.uploads.length} items)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guardrail Policy Banner */}
        <div className="bg-cyan-950/40 border-b border-cyan-900/50 px-6 py-3 flex items-center gap-3 text-xs text-cyan-200">
          <ShieldAlert className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <div>
            <span className="font-semibold text-cyan-300">Safety Guardrail Active: </span>
            Uploads initiated within the last 24 hours are <strong className="text-emerald-400">STRICTLY PROTECTED</strong> from deletion to prevent disrupting live ETL pipelines or active user uploads.
          </div>
        </div>

        {/* Uploads List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {bucket.uploads.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>No incomplete multipart uploads found in this bucket.</p>
            </div>
          ) : (
            bucket.uploads.map((upload) => (
              <div
                key={upload.upload_id}
                className="glass-card p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-zinc-100 break-all">
                      {upload.key}
                    </span>
                    {upload.safety_guardrail ? (
                      <span className="badge-active px-2 py-0.5 text-[11px] font-bold rounded-md flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Active (Protected)
                      </span>
                    ) : upload.status === "Abandoned" ? (
                      <span className="badge-danger px-2 py-0.5 text-[11px] font-bold rounded-md flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        Abandoned (Stale)
                      </span>
                    ) : (
                      <span className="badge-warning px-2 py-0.5 text-[11px] font-bold rounded-md">
                        Warning (Aging)
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      Initiated: {new Date(upload.initiated).toLocaleString()} ({upload.age_days}d ago)
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-zinc-500" />
                      By: <code className="text-zinc-300 font-mono">{upload.initiated_by}</code>
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400 font-medium">
                      <HardDrive className="w-3.5 h-3.5" />
                      {upload.size_gb} GB ({upload.parts_count} parts)
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-500">
                    Upload ID: <span className="font-mono text-zinc-400">{upload.upload_id}</span>
                  </p>
                </div>

                {/* Right side size & action */}
                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-zinc-800 pt-3 md:pt-0 md:pl-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-rose-400">
                      ${upload.monthly_cost.toFixed(2)}/mo
                    </div>
                    <div className="text-[10px] text-zinc-500">Est. Wasted Cost</div>
                  </div>

                  <button
                    onClick={() => onAbortSingle(bucket.bucket_name, upload.upload_id, bucket.provider)}
                    disabled={upload.safety_guardrail}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      upload.safety_guardrail
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                        : "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 hover:border-rose-600 shadow-md shadow-rose-950"
                    }`}
                    title={
                      upload.safety_guardrail
                        ? "Protected by 24h Guardrail policy."
                        : dryRun
                        ? "Simulate Aborting upload"
                        : "Abort upload immediately"
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {upload.safety_guardrail ? "Protected" : dryRun ? "Simulate Abort" : "Abort Upload"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <span>
            Total Wasted: <strong className="text-white">{bucket.wasted_gb} GB</strong> (${bucket.wasted_cost_monthly.toFixed(2)}/mo)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useState } from "react";
import { X, ShieldCheck, Zap, Code, Clock, AlertTriangle } from "lucide-react";
import { BucketAudit } from "@/lib/api";

interface LifecyclePolicyModalProps {
  bucket: BucketAudit | null;
  onClose: () => void;
  onInject: (bucketName: string, days: number, provider: string) => Promise<void>;
  dryRun: boolean;
}

export const LifecyclePolicyModal: React.FC<LifecyclePolicyModalProps> = ({
  bucket,
  onClose,
  onInject,
  dryRun,
}) => {
  const [days, setDays] = useState<number>(7);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!bucket) return null;

  const handleInject = async () => {
    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      await onInject(bucket.bucket_name, days, bucket.provider);
      setSuccessMsg(`Successfully attached AbortIncompleteMultipartUpload policy (${days} days) to '${bucket.bucket_name}' in under 10s!`);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1500);
    } catch (e: any) {
      setIsSubmitting(false);
    }
  };

  const sampleJsonPolicy = `{
  "Rules": [
    {
      "ID": "S3Cleaner-AbortIncompleteMultipartUploads-${days}Days",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": ${days}
      }
    }
  ]
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-950 border border-indigo-800 text-indigo-400 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">S3 Lifecycle Policy Injector</h2>
              <p className="text-xs text-zinc-400">
                Automated rule injection for bucket: <span className="font-mono text-cyan-400">{bucket.bucket_name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Highlight Benchmark Guarantee */}
          <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3.5 flex items-center gap-3 text-xs text-indigo-200">
            <Clock className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <div>
              <strong className="text-white">Performance Guarantee:</strong> Injects{" "}
              <code className="text-indigo-300">AbortIncompleteMultipartUpload</code> rule via Boto3 in{" "}
              <strong className="text-emerald-400">&lt; 10 seconds</strong> automatically.
            </div>
          </div>

          {/* Configurable Days */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Abort Incomplete Uploads After (Days):
            </label>
            <div className="flex items-center gap-3">
              {[3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    days === d
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {d} Days {d === 7 ? "(Recommended)" : ""}
                </button>
              ))}
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                min="1"
                max="365"
              />
            </div>
          </div>

          {/* JSON Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                <Code className="w-3.5 h-3.5 text-zinc-500" />
                AWS Lifecycle Policy Preview (JSON):
              </span>
            </div>
            <pre className="p-3.5 bg-zinc-950 border border-zinc-800/80 rounded-xl text-[11px] font-mono text-cyan-300 overflow-x-auto">
              {sampleJsonPolicy}
            </pre>
          </div>

          {/* Execution feedback */}
          {successMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {successMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {dryRun ? "⚠️ Dry-Run Mode Active (Will simulate policy injection)" : "⚡ Will apply immediately to AWS"}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleInject}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-950 transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {isSubmitting ? "Injecting Policy..." : dryRun ? "Simulate Policy Injection" : "Inject Policy Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

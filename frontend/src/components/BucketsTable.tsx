"use client";

import React, { useState } from "react";
import { Search, ShieldCheck, AlertTriangle, AlertCircle, Eye, Trash2, Zap, CheckSquare, Square, RefreshCw, Layers } from "lucide-react";
import { BucketAudit, PROVIDER_META } from "@/lib/api";

interface BucketsTableProps {
  buckets: BucketAudit[];
  onOpenUploadDetails: (bucket: BucketAudit) => void;
  onOpenLifecycleModal: (bucket: BucketAudit) => void;
  onAbortBucket: (bucketName: string, uploadIds: string[], provider?: string) => void;
  dryRun: boolean;
  isScanning: boolean;
}

export const BucketsTable: React.FC<BucketsTableProps> = ({
  buckets,
  onOpenUploadDetails,
  onOpenLifecycleModal,
  onAbortBucket,
  dryRun,
  isScanning,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedBucketNames, setSelectedBucketNames] = useState<string[]>([]);

  // Filter buckets
  const filteredBuckets = buckets.filter((b) => {
    const matchesSearch =
      b.bucket_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.provider || "").toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === "ALL") return true;
    if (statusFilter === "ABANDONED") return b.status === "Abandoned";
    if (statusFilter === "WARNING") return b.status === "Warning";
    if (statusFilter === "ACTIVE") return b.status === "Active";
    if (statusFilter === "NO_POLICY") return !b.has_lifecycle_policy;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedBucketNames.length === filteredBuckets.length) {
      setSelectedBucketNames([]);
    } else {
      setSelectedBucketNames(filteredBuckets.map((b) => b.bucket_name));
    }
  };

  const toggleSelectBucket = (name: string) => {
    if (selectedBucketNames.includes(name)) {
      setSelectedBucketNames(selectedBucketNames.filter((n) => n !== name));
    } else {
      setSelectedBucketNames([...selectedBucketNames, name]);
    }
  };

  const handleBulkAbort = () => {
    const selectedObj = buckets.filter((b) => selectedBucketNames.includes(b.bucket_name));
    selectedObj.forEach((b) => {
      const abandonedIds = b.uploads.filter((u) => u.status === "Abandoned" && !u.safety_guardrail).map((u) => u.upload_id);
      if (abandonedIds.length > 0) {
        onAbortBucket(b.bucket_name, abandonedIds, b.provider);
      }
    });
    setSelectedBucketNames([]);
  };

  return (
    <div className="glass-panel rounded-2xl border border-zinc-800 shadow-xl overflow-hidden mb-8">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Multi-Cloud Storage Waste Audit</h2>
            <p className="text-xs text-zinc-400">
              Showing {filteredBuckets.length} of {buckets.length} total scanned buckets
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search buckets or region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 w-56 transition-all"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "ALL" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter("ABANDONED")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "ABANDONED" ? "bg-rose-950/80 text-rose-300 border border-rose-800/60" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Abandoned (&gt;7d)
            </button>
            <button
              onClick={() => setStatusFilter("WARNING")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "WARNING" ? "bg-amber-950/80 text-amber-300 border border-amber-800/60" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Aging (24h-7d)
            </button>
            <button
              onClick={() => setStatusFilter("NO_POLICY")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "NO_POLICY" ? "bg-indigo-950/80 text-indigo-300 border border-indigo-800/60" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Missing Policy
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedBucketNames.length > 0 && (
        <div className="bg-indigo-950/70 border-b border-indigo-800/60 px-6 py-3 flex items-center justify-between animate-fade-in text-xs">
          <span className="font-semibold text-indigo-200">
            {selectedBucketNames.length} bucket(s) selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkAbort}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 rounded-lg font-semibold transition-all border border-rose-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {dryRun ? "Simulate Aborting Abandoned Uploads" : "Abort Abandoned Uploads"}
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950/80 uppercase tracking-wider text-[10px] font-semibold text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="p-4 w-10 text-center">
                <button onClick={toggleSelectAll} className="text-zinc-400 hover:text-white">
                  {selectedBucketNames.length === filteredBuckets.length && filteredBuckets.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="p-4">Bucket Name</th>
              <th className="p-4">Region</th>
              <th className="p-4">Audit Status</th>
              <th className="p-4">Reclaimable Storage</th>
              <th className="p-4">Monthly Cost ($)</th>
              <th className="p-4">Safety Flags</th>
              <th className="p-4">Lifecycle Policy</th>
              <th className="p-4 text-right">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {filteredBuckets.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-zinc-500">
                  No S3 buckets found matching your filters.
                </td>
              </tr>
            ) : (
              filteredBuckets.map((bucket) => {
                const isSelected = selectedBucketNames.includes(bucket.bucket_name);
                const abandonedCount = bucket.uploads.filter((u) => u.status === "Abandoned" && !u.safety_guardrail).length;

                return (
                  <tr
                    key={bucket.bucket_name}
                    className={`hover:bg-zinc-900/60 transition-colors ${
                      isSelected ? "bg-indigo-950/20" : ""
                    }`}
                  >
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleSelectBucket(bucket.bucket_name)}
                        className="text-zinc-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    <td className="p-4 font-mono font-bold text-white">
                      <div className="flex items-center gap-2">
                        <span>{bucket.bucket_name}</span>
                        {bucket.wasted_cost_monthly > 10 && (
                          <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase bg-rose-950 text-rose-400 border border-rose-800/60 rounded">
                            HIGH WASTE
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 font-mono text-zinc-400">
                      <div className="flex flex-col gap-1 items-start">
                        {bucket.provider && PROVIDER_META[bucket.provider as "aws" | "azure" | "gcp"] && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border inline-flex items-center gap-1 ${PROVIDER_META[bucket.provider as "aws" | "azure" | "gcp"].bgColor} ${PROVIDER_META[bucket.provider as "aws" | "azure" | "gcp"].color} ${PROVIDER_META[bucket.provider as "aws" | "azure" | "gcp"].borderColor}`}>
                            {PROVIDER_META[bucket.provider as "aws" | "azure" | "gcp"].icon} {PROVIDER_META[bucket.provider as "aws" | "azure" | "gcp"].label}
                          </span>
                        )}
                        <span>{bucket.region}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      {bucket.status === "Abandoned" ? (
                        <span className="badge-danger px-2.5 py-1 text-[11px] font-bold rounded-lg inline-flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          Abandoned (Stale)
                        </span>
                      ) : bucket.status === "Warning" ? (
                        <span className="badge-warning px-2.5 py-1 text-[11px] font-bold rounded-lg inline-flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Warning (Aging)
                        </span>
                      ) : (
                        <span className="badge-active px-2.5 py-1 text-[11px] font-bold rounded-lg inline-flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          Active (Protected)
                        </span>
                      )}
                    </td>

                    <td className="p-4 font-semibold text-zinc-200">
                      {bucket.wasted_gb} GB
                      <span className="text-[10px] text-zinc-500 block">
                        {bucket.total_uploads_count} multipart file(s)
                      </span>
                    </td>

                    <td className="p-4 font-bold text-rose-400">
                      ${bucket.wasted_cost_monthly.toFixed(2)}/mo
                    </td>

                    <td className="p-4">
                      {bucket.active_safety_flags > 0 ? (
                        <span className="badge-active px-2 py-0.5 text-[10px] font-bold rounded-md inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          {bucket.active_safety_flags} Active Guardrail
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">None</span>
                      )}
                    </td>

                    <td className="p-4">
                      {bucket.has_lifecycle_policy ? (
                        <span className="badge-cyan px-2 py-0.5 text-[10px] font-bold rounded-md inline-flex items-center gap-1">
                          <Zap className="w-3 h-3 text-cyan-400" />
                          Configured ({bucket.lifecycle_policy_days || 7}d)
                        </span>
                      ) : (
                        <button
                          onClick={() => onOpenLifecycleModal(bucket)}
                          className="text-amber-400 hover:underline text-[11px] font-semibold flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Missing (Inject)
                        </button>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onOpenUploadDetails(bucket)}
                          className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium text-[11px] flex items-center gap-1 transition-all"
                          title="View detailed incomplete upload parts"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          View Uploads
                        </button>

                        {!bucket.has_lifecycle_policy && (
                          <button
                            onClick={() => onOpenLifecycleModal(bucket)}
                            className="px-2.5 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-all"
                            title="Inject S3 Lifecycle Policy in under 10 seconds"
                          >
                            <Zap className="w-3.5 h-3.5 text-indigo-400" />
                            Inject Policy
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

"use client";

import React from "react";
import { DollarSign, HardDrive, Database, ShieldAlert, TrendingDown, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { AuditSummary } from "@/lib/api";

interface MetricCardsProps {
  summary: AuditSummary;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Metric 1: Total Wasted Cost */}
      <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Total Wasted Cost
          </span>
          <div className="p-2 bg-rose-950/60 border border-rose-800/40 text-rose-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-white">
            ${summary.total_wasted_cost_monthly.toFixed(2)}
          </span>
          <span className="text-xs font-medium text-rose-400 flex items-center">
            / month
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <TrendingDown className="w-3.5 h-3.5" />
            ${summary.yearly_potential_savings.toFixed(2)}/yr
          </span>
          <span className="text-zinc-500">Rate: $0.023/GB</span>
        </div>
      </div>

      {/* Metric 2: Storage Reclaimable */}
      <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Storage Reclaimable
          </span>
          <div className="p-2 bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 rounded-xl">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-white">
            {summary.total_wasted_gb.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-cyan-400">GB</span>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="text-zinc-300 font-medium">
            {summary.total_abandoned_uploads} Abandoned Uploads
          </span>
          <span className="text-amber-400">Stale &gt;7 Days</span>
        </div>
      </div>

      {/* Metric 3: Scanned Buckets */}
      <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Scanned Buckets
          </span>
          <div className="p-2 bg-indigo-950/60 border border-indigo-800/40 text-indigo-400 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-white">
            {summary.scanned_buckets_count}
          </span>
          <span className="text-xs font-medium text-indigo-400">Buckets</span>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="text-zinc-300 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {summary.total_warning_uploads} Warning Status
          </span>
          <span className="text-zinc-500">Multi-region</span>
        </div>
      </div>

      {/* Metric 4: Active Safety Guardrails */}
      <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Active Safety Guardrails
          </span>
          <div className="p-2 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-white">
            {summary.active_safety_flags}
          </span>
          <span className="text-xs font-medium text-emerald-400">Uploads Protected</span>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            Initiated &lt; 24h ago
          </span>
          <span className="text-zinc-500">Strictly Guarded</span>
        </div>
      </div>
    </div>
  );
};

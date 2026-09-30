"use client";

import React, { useState, useEffect } from "react";
import { Send, Clock, ShieldCheck, AlertTriangle, RefreshCw, FileText, CheckCircle2 } from "lucide-react";
import { fetchAuditLogs, AuditLogEntry } from "@/lib/api";

export const AuditLogDrawer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAuditLogs();
      setLogs(data.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-zinc-800 shadow-xl animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">System Audit & Real-Time Action Reports</h2>
            <p className="text-xs text-zinc-400">
              Chronological audit trail of S3 abort actions, lifecycle policy injections, and Slack Webhook notifications
            </p>
          </div>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Logs
        </button>
      </div>

      {/* Log Feed */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs">
            No audit log entries recorded yet.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="glass-card p-4 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{log.title}</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-zinc-900 border border-zinc-800 text-cyan-400">
                    {log.action}
                  </span>
                  {log.slack_sent ? (
                    <span className="badge-active px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Slack Webhook Sent
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                      Local Log
                    </span>
                  )}
                </div>
                <p className="text-zinc-300 font-mono text-[11px]">{log.details}</p>
              </div>

              <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-mono flex-shrink-0">
                <Clock className="w-3.5 h-3.5" />
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

"use client";

import React from "react";
import {
  Cloud, ShieldCheck, RefreshCw, Settings, Send, Cpu,
} from "lucide-react";
import { CloudProvider, PROVIDER_META } from "@/lib/api";

interface NavbarProps {
  useMock: boolean;
  setUseMock: (val: boolean) => void;
  dryRun: boolean;
  setDryRun: (val: boolean) => void;
  activeTab: "dashboard" | "ai" | "logs";
  setActiveTab: (tab: "dashboard" | "ai" | "logs") => void;
  activeProvider: CloudProvider;
  setActiveProvider: (p: CloudProvider) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onTestSlack: () => void;
  isScanning: boolean;
}

const PROVIDER_FILTERS: { value: CloudProvider; label: string; icon: string; accent: string }[] = [
  { value: "all",   label: "All Clouds", icon: "🌐", accent: "from-cyan-600 to-indigo-600" },
  { value: "aws",   label: "AWS S3",     icon: "☁️",  accent: "from-orange-600 to-amber-500" },
  { value: "azure", label: "Azure Blob", icon: "🔷",  accent: "from-blue-600 to-cyan-500" },
  { value: "gcp",   label: "GCP Storage",icon: "🟢",  accent: "from-emerald-600 to-teal-500" },
];

export const Navbar: React.FC<NavbarProps> = ({
  useMock, setUseMock, dryRun, setDryRun,
  activeTab, setActiveTab,
  activeProvider, setActiveProvider,
  onRefresh, onOpenSettings, onTestSlack, isScanning,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-zinc-800/80 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto space-y-3">

        {/* Row 1: Brand + Tabs + Actions */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-violet-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Cloud className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  CloudCleaner
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 rounded-full">
                  Multi-Cloud FinOps v2.0
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                AWS S3 · Azure Blob · GCP Storage — Stale Upload Pruner
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-950"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Audit Dashboard
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "ai"
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-violet-400" />
              AI FinOps Assistant
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "logs"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              Audit &amp; Slack Logs
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Dry-Run Toggle */}
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-medium text-zinc-300">Dry-Run:</span>
              <button
                onClick={() => setDryRun(!dryRun)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  dryRun ? "bg-amber-500" : "bg-zinc-700"
                }`}
                title="Dry-Run simulates changes safely without modifying live cloud resources."
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  dryRun ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${dryRun ? "text-amber-400" : "text-emerald-400"}`}>
                {dryRun ? "SAFE SIM" : "LIVE"}
              </span>
            </div>

            {/* Scan Button */}
            <button
              onClick={onRefresh}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning..." : "Scan"}
            </button>

            {/* Slack */}
            <button
              onClick={onTestSlack}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 rounded-xl transition-all"
              title="Test Slack Webhook"
            >
              <Send className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 rounded-xl transition-all"
              title="Cloud Credentials & Settings"
            >
              <Settings className="w-4 h-4 text-zinc-300" />
            </button>
          </div>
        </div>

        {/* Row 2: Provider Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mr-1">Provider:</span>
          {PROVIDER_FILTERS.map((pf) => (
            <button
              key={pf.value}
              onClick={() => setActiveProvider(pf.value)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                activeProvider === pf.value
                  ? `bg-gradient-to-r ${pf.accent} text-white border-transparent shadow-md`
                  : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              <span>{pf.icon}</span>
              {pf.label}
            </button>
          ))}

          {/* Mock toggle pill */}
          <button
            onClick={() => setUseMock(!useMock)}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              useMock
                ? "bg-violet-950/80 text-violet-300 border-violet-700"
                : "bg-emerald-950/80 text-emerald-300 border-emerald-700"
            }`}
          >
            {useMock ? "🔮 Mock Data" : "⚡ Live Data"}
          </button>
        </div>
      </div>
    </header>
  );
};

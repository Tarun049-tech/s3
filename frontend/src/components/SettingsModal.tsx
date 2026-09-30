"use client";

import React, { useState } from "react";
import { X, Key, Shield, Send, CheckCircle2, Save, HardDrive } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // AWS
  awsKey: string;       setAwsKey: (v: string) => void;
  awsSecret: string;    setAwsSecret: (v: string) => void;
  region: string;       setRegion: (v: string) => void;
  // Azure
  azureConnStr: string; setAzureConnStr: (v: string) => void;
  // GCP
  gcpSaJson: string;    setGcpSaJson: (v: string) => void;
  gcpProjectId: string; setGcpProjectId: (v: string) => void;
  // Slack
  slackWebhook: string; setSlackWebhook: (v: string) => void;
  onTestSlack: (url: string) => void;
}

type ProviderTab = "aws" | "azure" | "gcp";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose,
  awsKey, setAwsKey, awsSecret, setAwsSecret, region, setRegion,
  azureConnStr, setAzureConnStr,
  gcpSaJson, setGcpSaJson, gcpProjectId, setGcpProjectId,
  slackWebhook, setSlackWebhook, onTestSlack,
}) => {
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [providerTab, setProviderTab] = useState<ProviderTab>("aws");

  if (!isOpen) return null;

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => { setSavedSuccess(false); onClose(); }, 1200);
  };

  const tabClass = (p: ProviderTab) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
      providerTab === p
        ? p === "aws"   ? "bg-orange-950 text-orange-300 border border-orange-700"
        : p === "azure" ? "bg-blue-950 text-blue-300 border border-blue-700"
                        : "bg-emerald-950 text-emerald-300 border border-emerald-700"
        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Multi-Cloud Settings</h2>
              <p className="text-xs text-zinc-400">Configure AWS, Azure, GCP credentials and integrations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto max-h-[70vh]">

          {/* Provider tabs */}
          <div className="flex items-center gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
            <button className={tabClass("aws")}   onClick={() => setProviderTab("aws")}>☁️ AWS S3</button>
            <button className={tabClass("azure")} onClick={() => setProviderTab("azure")}>🔷 Azure Blob</button>
            <button className={tabClass("gcp")}   onClick={() => setProviderTab("gcp")}>🟢 GCP Storage</button>
          </div>

          {/* AWS Panel */}
          {providerTab === "aws" && (
            <div className="space-y-3">
              <h3 className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-orange-400" /> AWS Boto3 Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Access Key ID</label>
                  <input type="text" placeholder="AKIAIOSFODNN7EXAMPLE" value={awsKey}
                    onChange={(e) => setAwsKey(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Secret Access Key</label>
                  <input type="password" placeholder="wJalrXUtnFEMI/K7MDENG/..." value={awsSecret}
                    onChange={(e) => setAwsSecret(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Default AWS Region</label>
                <select value={region} onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 font-mono focus:outline-none focus:border-orange-500">
                  <option value="us-east-1">us-east-1 (N. Virginia – $0.023/GB)</option>
                  <option value="us-west-2">us-west-2 (Oregon – $0.023/GB)</option>
                  <option value="eu-west-1">eu-west-1 (Ireland – $0.024/GB)</option>
                  <option value="ap-southeast-1">ap-southeast-1 (Singapore – $0.025/GB)</option>
                </select>
              </div>
            </div>
          )}

          {/* Azure Panel */}
          {providerTab === "azure" && (
            <div className="space-y-3">
              <h3 className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" /> Azure Storage Credentials
              </h3>
              <div>
                <label className="block text-zinc-400 mb-1">Storage Connection String</label>
                <input type="password"
                  placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
                  value={azureConnStr} onChange={(e) => setAzureConnStr(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <p className="text-zinc-500 text-[11px]">
                Find this in Azure Portal → Storage Account → Access Keys → Connection string.
              </p>
            </div>
          )}

          {/* GCP Panel */}
          {providerTab === "gcp" && (
            <div className="space-y-3">
              <h3 className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> GCP Service Account Credentials
              </h3>
              <div>
                <label className="block text-zinc-400 mb-1">Service Account JSON Path</label>
                <input type="text" placeholder="/path/to/service-account-key.json"
                  value={gcpSaJson} onChange={(e) => setGcpSaJson(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">GCP Project ID</label>
                <input type="text" placeholder="my-gcp-project-prod"
                  value={gcpProjectId} onChange={(e) => setGcpProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-emerald-500" />
              </div>
              <p className="text-zinc-500 text-[11px]">
                Generate a key in GCP Console → IAM → Service Accounts → Keys. Grant "Storage Object Admin" role.
              </p>
            </div>
          )}

          {/* Slack Webhook */}
          <div className="space-y-3 pt-3 border-t border-zinc-800">
            <h3 className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-400" /> Slack Webhook Integration
            </h3>
            <div className="flex gap-2">
              <input type="text" placeholder="https://hooks.slack.com/services/T00/B00/XXXXX"
                value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)}
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-emerald-500" />
              <button onClick={() => onTestSlack(slackWebhook)}
                className="px-3 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-xl font-semibold flex items-center gap-1 transition-all">
                <Send className="w-3.5 h-3.5" /> Test
              </button>
            </div>
          </div>

          {/* Guardrail notice */}
          <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl flex items-center gap-3 text-zinc-400">
            <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="font-bold text-zinc-200">24-Hour Guardrail Policy: </span>
              CloudCleaner will NEVER abort uploads initiated within the last 24 hours — across all three cloud providers.
            </div>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Settings saved!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-zinc-500">Credentials stored in app session only</span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-all">Cancel</button>
            <button onClick={handleSave} className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-950 transition-all">
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

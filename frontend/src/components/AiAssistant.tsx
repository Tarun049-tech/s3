"use client";

import React, { useState, useEffect } from "react";
import { Cpu, Sparkles, Send, MessageSquare, RefreshCw, Bot, CheckCircle2, ShieldAlert, Zap } from "lucide-react";
import { ScanResponse, fetchAiSummary, fetchAiQuery } from "@/lib/api";

interface AiAssistantProps {
  scanData: ScanResponse | null;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ scanData }) => {
  const [summaryText, setSummaryText] = useState<string>("");
  const [summarySource, setSummarySource] = useState<string>("");
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);

  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string; source?: string }>>([
    {
      sender: "ai",
      text: "👋 Hello! I am your OpenAI FinOps Assistant. Ask me anything about your AWS S3 buckets, multipart upload costs, guardrail policies, or storage optimization opportunities!",
      source: "S3Cleaner FinOps Assistant"
    }
  ]);
  const [queryInput, setQueryInput] = useState<string>("");
  const [isQuerying, setIsQuerying] = useState<boolean>(false);

  useEffect(() => {
    loadSummary();
  }, [scanData]);

  const loadSummary = async () => {
    if (!scanData) return;
    setIsLoadingSummary(true);
    try {
      const res = await fetchAiSummary(scanData);
      setSummaryText(res.summary_text);
      setSummarySource(res.source);
    } catch (e) {
      setSummaryText("Failed to generate AI summary.");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleSendQuery = async (queryToSubmit?: string) => {
    const q = (queryToSubmit || queryInput).trim();
    if (!q || isQuerying) return;

    setChatMessages((prev) => [...prev, { sender: "user", text: q }]);
    if (!queryToSubmit) setQueryInput("");
    setIsQuerying(true);

    try {
      const res = await fetchAiQuery(q, scanData || undefined);
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: res.answer, source: res.source }
      ]);
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Sorry, an error occurred processing your query." }
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  const sampleQuestions = [
    "Which bucket wastes the most money?",
    "What is our total yearly savings opportunity?",
    "Why are uploads under 24 hours protected?",
    "Which buckets lack an automated 7-day lifecycle policy?"
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-zinc-800 bg-gradient-to-r from-indigo-950/40 via-zinc-900 to-violet-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-950">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">AI FinOps Assistant</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-950 text-violet-300 border border-violet-800 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                OpenAI GPT-4o Powered
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Generates executive cost summaries and answers natural language AWS storage queries.
            </p>
          </div>
        </div>

        <button
          onClick={loadSummary}
          disabled={isLoadingSummary}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-violet-400 ${isLoadingSummary ? "animate-spin" : ""}`} />
          Re-generate AI Summary
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Executive Summary */}
        <div className="glass-panel p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                Executive Cost-Optimization Summary
              </span>
              {summarySource && (
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  Source: {summarySource}
                </span>
              )}
            </div>

            {isLoadingSummary ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mx-auto" />
                <p className="text-xs text-zinc-400">Analyzing S3 bucket scan metrics with OpenAI GPT-4o...</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-xs text-zinc-300 max-w-none space-y-3 leading-relaxed">
                {summaryText.split("\n\n").map((paragraph, idx) => (
                  <div key={idx} className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
                    {paragraph.split("\n").map((line, lIdx) => {
                      if (line.startsWith("###")) {
                        return <h3 key={lIdx} className="text-sm font-bold text-violet-300 mb-2">{line.replace("###", "")}</h3>;
                      } else if (line.startsWith("**") || line.startsWith("- **")) {
                        return <p key={lIdx} className="text-xs text-zinc-200 font-medium my-1">{line}</p>;
                      } else {
                        return <p key={lIdx} className="text-xs text-zinc-400 my-1">{line}</p>;
                      }
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Calculated using regional AWS rates ($0.023/GB/mo)</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Guardrail Active (&lt;24h protected)
            </span>
          </div>
        </div>

        {/* Right Column: Natural Language FinOps Chat */}
        <div className="glass-panel p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col h-[520px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Natural Language FinOps Query Interface
            </h3>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 mb-4">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "ai" && (
                  <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-800 flex items-center justify-center text-violet-400 flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-medium rounded-br-none shadow-md shadow-indigo-950"
                      : "bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-bl-none"
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.source && (
                    <span className="block text-[9px] text-zinc-500 mt-1.5 font-mono">
                      {msg.source}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {isQuerying && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-800 flex items-center justify-center text-violet-400 flex-shrink-0">
                  <Bot className="w-4 h-4 animate-bounce" />
                </div>
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-2xl text-xs text-zinc-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                  Reasoning over S3 audit data...
                </div>
              </div>
            )}
          </div>

          {/* Prompt Suggestion Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuery(q)}
                className="whitespace-nowrap px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-[11px] font-medium text-cyan-300 rounded-lg transition-all"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="flex items-center gap-2 pt-2 border-t border-zinc-800"
          >
            <input
              type="text"
              placeholder="Ask a question (e.g., Which bucket wastes the most money?)"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-all"
            />
            <button
              type="submit"
              disabled={isQuerying || !queryInput.trim()}
              className="p-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useCallback, useRef } from "react";
import {
  Upload, Plus, Trash2, Download, Zap, FileCode,
  FolderSearch, CheckCircle2, AlertCircle, Terminal,
  Code2, Archive, File, X
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { CodeEditor } from "@/components/CodeEditor";

interface FileData {
  name: string;
  content: string;
  selected?: boolean;
}

interface GenerationResult {
  files?: FileData[];
  error?: string;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<"javascript" | "python">("javascript");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [newFileName, setNewFileName] = useState("");
  const [agentStatus, setAgentStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const files = result?.files ?? [];

  const updateFiles = (updated: FileData[]) => {
    setResult((prev) => ({ ...prev, files: updated }));
  };

  const handleAddFile = () => {
    if (!newFileName.trim()) return;
    const name = newFileName.includes(".") ? newFileName : `${newFileName}.js`;
    const newFile: FileData = { name, content: `// ${name}\n`, selected: false };
    const updated = [...files, newFile];
    updateFiles(updated);
    setSelectedFileIndex(updated.length - 1);
    setNewFileName("");
  };

  const handleDeleteFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    updateFiles(updated);
    setSelectedFileIndex(Math.max(0, Math.min(selectedFileIndex, updated.length - 1)));
  };

  const handleUpdateContent = (content: string) => {
    const updated = files.map((f, i) => i === selectedFileIndex ? { ...f, content } : f);
    updateFiles(updated);
  };

  const handleToggleSelect = (idx: number) => {
    const updated = files.map((f, i) => i === idx ? { ...f, selected: !f.selected } : f);
    updateFiles(updated);
  };

  const handleSelectAll = () => {
    const allSelected = files.every((f) => f.selected);
    updateFiles(files.map((f) => ({ ...f, selected: !allSelected })));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded) return;
    Array.from(uploaded).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setResult((prev) => {
          const existing = prev?.files ?? [];
          return { ...prev, files: [...existing, { name: file.name, content, selected: false }] };
        });
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  const handleDownloadZip = async (selectedOnly = false) => {
    const toZip = selectedOnly ? files.filter((f) => f.selected) : files;
    if (!toZip.length) return;
    const zip = new JSZip();
    toZip.forEach((f) => zip.file(f.name, f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "discord-bot-project.zip");
  };

  const handleDownloadFile = () => {
    const f = files[selectedFileIndex];
    if (!f) return;
    const blob = new Blob([f.content], { type: "text/plain" });
    saveAs(blob, f.name);
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setResult(null);
    setSelectedFileIndex(0);
    setAgentStatus("Agent 1: Architecting file structure...");

    const timer1 = setTimeout(() => setAgentStatus("Agent 2: Writing all code files..."), 8000);
    const timer2 = setTimeout(() => setAgentStatus("Agent 3: Reviewing & fixing bugs..."), 20000);

    try {
      const resp = await fetch(`${BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Server error" }));
        setResult({ error: (err as { error?: string }).error ?? "Generation failed." });
        return;
      }
      const data = (await resp.json()) as GenerationResult;
      if (data.files) {
        data.files = data.files.map((f) => ({ ...f, selected: false }));
      }
      setResult(data);
    } catch {
      setResult({ error: "Failed to connect to the server. Please try again." });
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsGenerating(false);
      setAgentStatus("");
    }
  }, [prompt, language]);

  const selectedCount = files.filter((f) => f.selected).length;
  const currentFile = files[selectedFileIndex];

  return (
    <div className="h-screen flex flex-col bg-[hsl(222,47%,8%)] text-[hsl(213,31%,91%)] font-sans overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[hsl(217,33%,17%)] bg-[hsl(222,47%,6%)] px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">Discord Architect</h1>
            <p className="text-[10px] text-[hsl(215,20%,45%)] font-mono">3-Agent Claude Pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(217,33%,13%)] border border-[hsl(217,33%,17%)]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          <span className="text-[10px] font-mono text-[hsl(215,20%,55%)]">3 Keys Active</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 border-r border-[hsl(217,33%,17%)] bg-[hsl(222,47%,9%)] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[hsl(215,20%,55%)] flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Request
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
                }}
                placeholder="e.g., Create a Discord bot with leveling, welcome messages, and moderation commands..."
                className="w-full h-40 bg-[hsl(222,47%,6%)] border border-[hsl(217,33%,17%)] rounded-lg p-3 text-xs focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-none placeholder:text-[hsl(215,20%,35%)] leading-relaxed"
              />
              <p className="text-[10px] text-[hsl(215,20%,35%)]">Ctrl+Enter to generate</p>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[hsl(215,20%,55%)] flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                Language
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["javascript", "python"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                      language === lang
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                        : "bg-[hsl(222,47%,6%)] border-[hsl(217,33%,17%)] text-[hsl(215,20%,55%)] hover:border-[hsl(217,33%,25%)]"
                    )}
                  >
                    {lang === "javascript" ? "JS / TS" : "Python"}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 group"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Architect Code
                </>
              )}
            </button>

            {/* Info */}
            <div className="bg-[hsl(222,47%,6%)] border border-[hsl(217,33%,17%)] rounded-lg p-3 flex gap-2">
              <FolderSearch className="w-4 h-4 text-[hsl(215,20%,45%)] mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-[hsl(215,20%,45%)] leading-relaxed">
                3-agent pipeline: Architect plans the structure → Coder implements all files → Reviewer fixes bugs.
              </p>
            </div>
          </div>

          {/* File list (when files exist) */}
          {files.length > 0 && (
            <div className="border-t border-[hsl(217,33%,17%)] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[hsl(215,20%,55%)]">{files.length} file{files.length !== 1 ? "s" : ""}</span>
                <button onClick={handleSelectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
                  {files.every((f) => f.selected) ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
                {files.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-all",
                      selectedFileIndex === idx
                        ? "bg-indigo-600/20 border border-indigo-500/30"
                        : "hover:bg-[hsl(217,33%,17%)] border border-transparent"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!file.selected}
                      onChange={() => handleToggleSelect(idx)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3 h-3 accent-indigo-500 flex-shrink-0"
                    />
                    <button
                      onClick={() => setSelectedFileIndex(idx)}
                      className="flex-1 text-left flex items-center gap-1.5 min-w-0"
                    >
                      <FileCode className="w-3 h-3 text-[hsl(215,20%,45%)] flex-shrink-0" />
                      <span className="text-[11px] font-mono truncate">{file.name}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteFile(idx)}
                      className="opacity-0 group-hover:opacity-100 text-[hsl(215,20%,45%)] hover:text-red-400 transition-all flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add file */}
              <div className="flex items-center gap-1 pt-1">
                <input
                  type="text"
                  placeholder="new-file.js"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFile()}
                  className="flex-1 bg-[hsl(222,47%,6%)] border border-[hsl(217,33%,17%)] rounded-md px-2 py-1 text-[11px] font-mono focus:ring-1 focus:ring-indigo-500/50 outline-none min-w-0"
                />
                <button onClick={handleAddFile} className="p-1 bg-[hsl(217,33%,17%)] hover:bg-[hsl(217,33%,22%)] rounded-md text-[hsl(215,20%,55%)] transition-colors" title="Add file">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-1 bg-[hsl(217,33%,17%)] hover:bg-[hsl(217,33%,22%)] rounded-md text-[hsl(215,20%,55%)] transition-colors" title="Upload files">
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
              </div>

              {/* Download options */}
              <div className="flex gap-1 pt-1">
                <button
                  onClick={() => handleDownloadZip(false)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-md text-[10px] font-bold border border-emerald-600/20 transition-all"
                  title="Download all as ZIP"
                >
                  <Archive className="w-3 h-3" />
                  All ZIP
                </button>
                {selectedCount > 0 && (
                  <button
                    onClick={() => handleDownloadZip(true)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-md text-[10px] font-bold border border-blue-600/20 transition-all"
                    title={`Download ${selectedCount} selected as ZIP`}
                  >
                    <Archive className="w-3 h-3" />
                    {selectedCount} ZIP
                  </button>
                )}
                <button
                  onClick={handleDownloadFile}
                  disabled={!currentFile}
                  className="flex items-center justify-center p-1.5 bg-[hsl(217,33%,17%)] hover:bg-[hsl(217,33%,22%)] rounded-md text-[hsl(215,20%,55%)] transition-colors disabled:opacity-40"
                  title="Download current file"
                >
                  <File className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main editor area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Empty state */}
          {!result && !isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-[hsl(217,33%,13%)] rounded-2xl flex items-center justify-center">
                <FileCode className="w-8 h-8 text-[hsl(215,20%,35%)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[hsl(215,20%,70%)]">Ready to Build</h3>
                <p className="text-sm text-[hsl(215,20%,45%)] mt-1 max-w-xs">
                  Describe your Discord bot and let the 3-agent Claude pipeline generate a complete, working project.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 max-w-sm w-full">
                {[
                  { icon: "🏗️", label: "Agent 1", desc: "Architect" },
                  { icon: "💻", label: "Agent 2", desc: "Coder" },
                  { icon: "🔍", label: "Agent 3", desc: "Reviewer" },
                ].map((a) => (
                  <div key={a.label} className="bg-[hsl(222,47%,11%)] border border-[hsl(217,33%,17%)] rounded-lg p-3 text-center">
                    <div className="text-xl mb-1">{a.icon}</div>
                    <div className="text-[10px] font-bold text-indigo-400">{a.label}</div>
                    <div className="text-[10px] text-[hsl(215,20%,45%)]">{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generating state */}
          {isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-[hsl(217,33%,17%)] border-t-indigo-600 rounded-full animate-spin" />
                <Zap className="w-6 h-6 text-indigo-500 absolute inset-0 m-auto" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-base font-bold">{agentStatus || "Processing..."}</h3>
                <div className="flex gap-1 justify-center">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-xs text-[hsl(215,20%,45%)]">This may take 30–60 seconds for complex bots</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {result?.error && !isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm font-medium text-red-400">{result.error}</p>
              <button onClick={() => setResult(null)} className="text-xs underline text-[hsl(215,20%,45%)] hover:text-[hsl(215,20%,65%)]">Reset</button>
            </div>
          )}

          {/* Editor */}
          {result && !result.error && !isGenerating && files.length > 0 && (
            <>
              {/* File tabs */}
              <div className="flex-shrink-0 border-b border-[hsl(217,33%,17%)] bg-[hsl(222,47%,7%)] flex items-center px-2 overflow-x-auto no-scrollbar">
                {files.map((file, idx) => (
                  <button
                    key={`${file.name}-${idx}`}
                    onClick={() => setSelectedFileIndex(idx)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono whitespace-nowrap border-b-2 transition-all shrink-0",
                      selectedFileIndex === idx
                        ? "border-indigo-500 text-white bg-[hsl(217,33%,13%)]"
                        : "border-transparent text-[hsl(215,20%,50%)] hover:text-[hsl(215,20%,70%)]"
                    )}
                  >
                    {file.selected && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                    <FileCode className="w-3 h-3 flex-shrink-0" />
                    {file.name}
                  </button>
                ))}
              </div>

              {/* Status bar */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-1 bg-[hsl(222,47%,6%)] border-b border-[hsl(217,33%,17%)]">
                <div className="flex items-center gap-3 text-[10px] text-[hsl(215,20%,45%)]">
                  <span className="font-mono">{currentFile?.name}</span>
                  <span>{currentFile?.content.split("\n").length ?? 0} lines</span>
                  {selectedCount > 0 && (
                    <span className="text-blue-400">{selectedCount} selected</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-[hsl(215,20%,45%)]">Editor Live</span>
                </div>
              </div>

              {/* Code editor */}
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  key={selectedFileIndex}
                  value={currentFile?.content ?? ""}
                  onChange={handleUpdateContent}
                  filename={currentFile?.name}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

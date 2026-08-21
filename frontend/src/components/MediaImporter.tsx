"use client";

import React, { useState, useRef } from "react";
import { Link2, Sparkles, Upload, FileVideo, Clock, User, ArrowRight, Loader2, Video, Sliders, CheckCircle2 } from "lucide-react";

export interface VideoMetadata {
  title: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
}

interface MediaImporterProps {
  onStartProcess: (params: {
    mode: "file" | "url";
    file?: File;
    url?: string;
    info?: VideoMetadata;
    aspectRatio: string;
    subtitleStyle: string;
    clipQuantity: number;
    prompt: string;
  }) => void;
  isLoading: boolean;
}

export default function MediaImporter({ onStartProcess, isLoading }: MediaImporterProps) {
  const [activeTab, setActiveTab] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoMetadata | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Settings
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [subtitleStyle, setSubtitleStyle] = useState("Neon");
  const [clipQuantity, setClipQuantity] = useState(3);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);
    setVideoInfo({
      title: file.name.replace(/\.[^/.]+$/, ""),
      uploader: "Arquivo Local",
      thumbnail: "",
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFetchUrlInfo = async () => {
    if (!url.trim()) return;
    setIsFetchingInfo(true);

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiHost}/api/v1/analyze-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error("Falha ao analisar URL");
      const data = await res.json();
      setVideoInfo(data);
    } catch {
      setVideoInfo({
        title: "Vídeo Web Importado",
        duration: 300,
        uploader: "Canal Online",
      });
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  const handleSubmit = () => {
    if (activeTab === "file" && selectedFile) {
      onStartProcess({
        mode: "file",
        file: selectedFile,
        info: videoInfo || { title: selectedFile.name },
        aspectRatio,
        subtitleStyle,
        clipQuantity,
        prompt: customPrompt,
      });
    } else if (activeTab === "url" && url.trim()) {
      onStartProcess({
        mode: "url",
        url,
        info: videoInfo || { title: "Vídeo Web" },
        aspectRatio,
        subtitleStyle,
        clipQuantity,
        prompt: customPrompt,
      });
    }
  };

  const canSubmit = (activeTab === "file" && selectedFile !== null) || (activeTab === "url" && url.trim().length > 0);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Hero Headline */}
      <div className="text-center space-y-3 pt-6 pb-2">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold tracking-wide shadow-sm">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Motor de IA em Nuvem Ultra Rápido (Whisper + Gemini Flash)</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Transforme vídeos longos em <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">cortes virais</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
          Faça upload do seu arquivo de vídeo ou cole um link do YouTube para transcrever, detectar ganchos e gerar cortes em segundos.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-[#10121d] rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden border border-violet-500/20 shadow-2xl">
        
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Input Mode Selector */}
        <div className="flex p-1 bg-black/50 rounded-2xl border border-white/10 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeTab === "file"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload de Vídeo Local</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeTab === "url"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Link do YouTube / Web</span>
          </button>
        </div>

        {/* Tab 1: File Upload */}
        {activeTab === "file" && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {!selectedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-violet-400 bg-violet-600/10 scale-[1.01]"
                    : "border-white/10 hover:border-violet-500/50 bg-black/40 hover:bg-white/5"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 text-violet-400">
                  <FileVideo className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  Arraste e solte seu vídeo aqui ou clique para selecionar
                </h3>
                <p className="text-xs text-gray-400">
                  Suporta MP4, MOV, MKV, AVI, WebM (Sem limite de tamanho)
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center space-x-4 min-w-0">
                  {filePreviewUrl ? (
                    <video
                      src={filePreviewUrl}
                      className="w-24 h-16 object-cover rounded-xl border border-white/10"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-300">
                      <FileVideo className="w-8 h-8" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-white truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400 font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreviewUrl(null);
                    setVideoInfo(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-xs font-semibold text-gray-300 hover:text-red-300 border border-white/10 transition-all cursor-pointer"
                >
                  Trocar Arquivo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: URL Importer */}
        {activeTab === "url" && (
          <div className="space-y-4">
            <div className="relative flex items-center">
              <div className="absolute left-4 text-gray-400 pointer-events-none">
                <Video className="w-5 h-5 text-red-500" />
              </div>

              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setVideoInfo(null);
                }}
                onBlur={handleFetchUrlInfo}
                placeholder="Cole o link do YouTube: https://www.youtube.com/watch?v=..."
                className="w-full bg-black/60 border border-white/10 rounded-2xl pl-12 pr-32 py-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />

              <button
                type="button"
                onClick={handleFetchUrlInfo}
                disabled={isFetchingInfo || !url.trim()}
                className="absolute right-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-gray-200 border border-white/10 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isFetchingInfo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Analisando...</span>
                  </>
                ) : (
                  <span>Analisar</span>
                )}
              </button>
            </div>

            {videoInfo && videoInfo.title && (
              <div className="flex items-center space-x-4 p-4 rounded-2xl bg-white/5 border border-white/10 animate-fadeIn">
                {videoInfo.thumbnail ? (
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-28 h-18 object-cover rounded-xl border border-white/10"
                  />
                ) : (
                  <div className="w-20 h-16 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-300">
                    <Video className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-white truncate">{videoInfo.title}</h4>
                  <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
                    {videoInfo.duration && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDuration(videoInfo.duration)}</span>
                      </span>
                    )}
                    {videoInfo.uploader && (
                      <span className="flex items-center space-x-1">
                        <User className="w-3.5 h-3.5 text-violet-400" />
                        <span>{videoInfo.uploader}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Presets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/5">
          
          {/* Aspect Ratio */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
              Formato de Corte
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "9:16", label: "9:16", desc: "Shorts" },
                { id: "1:1", label: "1:1", desc: "Feed" },
                { id: "16:9", label: "16:9", desc: "Wide" }
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setAspectRatio(opt.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    aspectRatio === opt.id
                      ? "bg-violet-600/30 border-violet-500 text-white shadow-md shadow-violet-500/20"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <p className="font-bold text-xs">{opt.label}</p>
                  <p className="text-[10px] text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Style */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
              Estilo de Legenda
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "Neon", label: "Neon", desc: "TikTok" },
                { id: "Fire", label: "Fire", desc: "Fogo" },
                { id: "Clean", label: "Clean", desc: "Minimal" }
              ].map((sub) => (
                <button
                  type="button"
                  key={sub.id}
                  onClick={() => setSubtitleStyle(sub.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    subtitleStyle === sub.id
                      ? "bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/20"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <p className="font-bold text-xs">{sub.label}</p>
                  <p className="text-[10px] text-cyan-300">{sub.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Clip Quantity */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
              Quantidade de Cortes
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 3, 5].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setClipQuantity(num)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    clipQuantity === num
                      ? "bg-fuchsia-600/30 border-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <p className="font-bold text-xs">{num} {num === 1 ? "Corte" : "Cortes"}</p>
                  <p className="text-[10px] text-gray-400">{num === 3 ? "Recomendado" : "Opção"}</p>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Optional Custom Instructions */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center space-x-1.5 font-semibold cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showAdvanced ? "Ocultar Instruções Personalizadas" : "+ Adicionar Instrução de IA (Opcional)"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ex: 'Foque nos momentos de comédia e piadas' ou 'Corte onde ele explica a estratégia de marketing'"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-all"
              />
            </div>
          )}
        </div>

        {/* Start Action Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !canSubmit}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-extrabold text-base shadow-xl shadow-violet-600/30 transition-all flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>Iniciando Pipeline de IA...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
              <span>Gerar Cortes Automáticos</span>
              <ArrowRight className="w-5 h-5 text-white" />
            </>
          )}
        </button>

      </div>
    </div>
  );
}

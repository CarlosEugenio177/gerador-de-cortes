"use client";

import React, { useState } from "react";
import { Zap, Download, Copy, Check, Flame, FileText, Layers, Archive, ChevronDown } from "lucide-react";

export interface ClipItem {
  id: number;
  title: string;
  hook_summary: string;
  start_time: number;
  end_time: number;
  duration: number;
  viral_score: number;
  suggested_captions: string;
  suggested_hashtags: string[];
  media_url?: string;
}

interface PlaysquadClipGalleryProps {
  clips: ClipItem[];
  videoTitle?: string;
}

export default function PlaysquadClipGallery({ clips }: PlaysquadClipGalleryProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [openExportMenuId, setOpenExportMenuId] = useState<number | null>(null);

  const getApiHost = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const resolveVideoUrl = (rawUrl?: string): string | null => {
    if (!rawUrl || rawUrl.trim() === "") return null;
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
    
    let clean = rawUrl.replace(/\\/g, "/").replace(/^\/?app\//, "/");
    if (!clean.startsWith("/")) {
      clean = "/" + clean;
    }
    return `${getApiHost()}${clean}`;
  };

  const handleCopyCaption = (clip: ClipItem) => {
    const textToCopy = `${clip.title}\n\n${clip.suggested_captions}\n\n${(clip.suggested_hashtags || []).join(" ")}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fadeIn">
      
      {/* Gallery Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-[#0c0d14] rounded-2xl border border-white/10 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Concluído
            </span>
            <span className="text-xs text-gray-400 font-medium">{clips.length} Cortes Gerados</span>
          </div>
          <h2 className="text-xl font-bold text-white">Seus Cortes Virais</h2>
          <p className="text-xs text-gray-400">Assista aos vídeos, faça download ou exporte para seu editor preferido.</p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 border border-white/10 transition-all cursor-pointer"
        >
          Processar Novo Vídeo
        </button>
      </div>

      {/* Clip Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clips.map((clip) => {
          const videoSrc = resolveVideoUrl(clip.media_url);
          const isMenuOpen = openExportMenuId === clip.id;

          return (
            <div
              key={clip.id}
              className="bg-[#0e1017] rounded-2xl border border-white/10 hover:border-violet-500/30 transition-all flex flex-col overflow-hidden shadow-lg"
            >
              
              {/* Score Header */}
              <div className="px-4 py-2.5 flex items-center justify-between bg-black/30 border-b border-white/5">
                <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-bold">
                  <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                  <span>Score: {clip.viral_score}/100</span>
                </div>
                <span className="text-xs font-mono text-gray-400">{clip.duration}s</span>
              </div>

              {/* 9:16 Video Player */}
              <div className="relative aspect-[9/16] bg-black flex items-center justify-center overflow-hidden">
                {videoSrc ? (
                  <video
                    src={videoSrc}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-violet-400">
                      <Flame className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-gray-300">{clip.title}</p>
                    <p className="text-[11px] text-gray-500">{clip.start_time}s até {clip.end_time}s</p>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-[#0e1017]">
                
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">
                    {clip.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-2">
                    {clip.hook_summary}
                  </p>
                </div>

                {/* Hashtags */}
                <div className="flex flex-wrap gap-1">
                  {(clip.suggested_hashtags || []).map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-cyan-300 border border-white/5">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Buttons */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCaption(clip)}
                      className="py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      {copiedId === clip.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>

                    {videoSrc ? (
                      <a
                        href={videoSrc}
                        download={`corte_${clip.id}.mp4`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar MP4</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="py-2 rounded-xl bg-white/5 text-xs text-gray-500 flex items-center justify-center space-x-1.5 opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Indisponível</span>
                      </button>
                    )}
                  </div>

                  {/* NLE Export Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenExportMenuId(isMenuOpen ? null : clip.id)}
                      className="w-full py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white text-xs font-medium flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Exportar p/ Editores</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 bg-[#141622] border border-white/10 rounded-xl shadow-xl space-y-0.5 z-20 animate-fadeIn">
                        <a
                          href={`${getApiHost()}/api/v1/clips/${clip.id}/export/bundle`}
                          download={`clip_${clip.id}_editor_pack.zip`}
                          className="flex items-center space-x-2 p-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 text-xs font-semibold transition-all"
                        >
                          <Archive className="w-3.5 h-3.5 text-cyan-300" />
                          <div>
                            <p>Pacote Completo (.ZIP)</p>
                            <p className="text-[9px] text-gray-400 font-normal">Vídeo + EDL + SRT + ASS</p>
                          </div>
                        </a>

                        <a
                          href={`${getApiHost()}/api/v1/clips/${clip.id}/export/edl`}
                          download={`clip_${clip.id}.edl`}
                          className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white text-xs transition-all"
                        >
                          <Layers className="w-3.5 h-3.5 text-violet-400" />
                          <div>
                            <p>Timeline EDL (Premiere/DaVinci)</p>
                          </div>
                        </a>

                        <a
                          href={`${getApiHost()}/api/v1/clips/${clip.id}/export/srt`}
                          download={`clip_${clip.id}.srt`}
                          className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white text-xs transition-all"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <div>
                            <p>Legenda SRT (CapCut/Premiere)</p>
                          </div>
                        </a>
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}

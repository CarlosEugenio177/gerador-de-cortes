"use client";

import React, { useState } from "react";
import { Zap, Download, Copy, Check, Play, Pause, Share2, Sparkles, Flame } from "lucide-react";

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

export default function PlaysquadClipGallery({ clips, videoTitle }: PlaysquadClipGalleryProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopyCaption = (clip: ClipItem) => {
    const textToCopy = `${clip.title}\n\n${clip.suggested_captions}\n\n${(clip.suggested_hashtags || []).join(" ")}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getApiHost = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pt-4">
      
      {/* Gallery Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 playsquad-card border border-violet-500/30">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs uppercase font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Processamento Concluído
            </span>
            <span className="text-xs text-gray-400 font-semibold">{clips.length} Cortes Gerados</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">Seus Cortes Prontos para Viralizar 🚀</h2>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold text-gray-200 border border-white/10 transition-all cursor-pointer"
        >
          Processar Novo Vídeo
        </button>
      </div>

      {/* Clip Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clips.map((clip) => {
          const videoSrc = clip.media_url ? `${getApiHost()}${clip.media_url}` : null;

          return (
            <div
              key={clip.id}
              className="playsquad-card border border-white/10 hover:border-violet-500/40 transition-all duration-300 flex flex-col overflow-hidden group shadow-xl"
            >
              
              {/* Top Score Badge */}
              <div className="p-4 pb-2 flex items-center justify-between bg-black/40 border-b border-white/5">
                <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-violet-600/30 border border-violet-500/50 text-violet-300 text-xs font-extrabold shadow-sm">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
                  <span>Potencial Viral: {clip.viral_score}/100</span>
                </div>
                <span className="text-xs font-mono font-semibold text-gray-400">{clip.duration}s</span>
              </div>

              {/* 9:16 Video Player Container */}
              <div className="relative aspect-[9/16] bg-black flex items-center justify-center overflow-hidden border-y border-white/5 group">
                {videoSrc ? (
                  <video
                    src={videoSrc}
                    controls
                    className="w-full h-full object-cover"
                    poster=""
                  />
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-400">
                      <Flame className="w-8 h-8" />
                    </div>
                    <p className="text-xs font-bold text-gray-300">Corte 9:16 Pronto</p>
                    <p className="text-[11px] text-gray-500">{clip.start_time}s até {clip.end_time}s</p>
                  </div>
                )}
              </div>

              {/* Content Body */}
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between bg-[#121420]">
                
                <div className="space-y-2">
                  <h3 className="font-bold text-white text-base leading-snug line-clamp-2">
                    {clip.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-2">
                    {clip.hook_summary}
                  </p>
                </div>

                {/* Hashtags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(clip.suggested_hashtags || []).map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-cyan-300 border border-white/5">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-3">
                  
                  <button
                    onClick={() => handleCopyCaption(clip)}
                    className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    {copiedId === clip.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-400" />
                        <span>Copiar Legenda</span>
                      </>
                    )}
                  </button>

                  {videoSrc ? (
                    <a
                      href={videoSrc}
                      download={`corte_${clip.id}.mp4`}
                      className="py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-xs font-extrabold text-white shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                      <span>Baixar MP4</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-500 flex items-center justify-center space-x-1.5 opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Processando</span>
                    </button>
                  )}

                </div>

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}

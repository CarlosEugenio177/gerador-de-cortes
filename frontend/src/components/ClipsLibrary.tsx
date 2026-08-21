"use client";

import React, { useState, useEffect } from "react";
import { Zap, Download, Copy, Check, Film, Layers, FileText, Archive, ChevronDown, Trash2, RefreshCw, Clock } from "lucide-react";
import { ClipItem } from "./PlaysquadClipGallery";

export default function ClipsLibrary() {
  const [projects, setProjects] = useState<any[]>([]);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [openExportMenuId, setOpenExportMenuId] = useState<number | null>(null);

  const getApiHost = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchLibrary = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiHost()}/api/v1/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data || []);

        // Extract all clips
        const allClips: ClipItem[] = [];
        (data || []).forEach((proj: any) => {
          (proj.clips || []).forEach((c: any) => {
            allClips.push({
              id: c.id,
              title: c.title,
              hook_summary: c.description || "Gancho de retenção",
              start_time: c.start_time || 0,
              end_time: c.end_time || 30,
              duration: Math.round(((c.end_time || 30) - (c.start_time || 0)) * 10) / 10,
              viral_score: Math.round(c.score || 95),
              suggested_captions: c.description || "",
              suggested_hashtags: ["#viral", "#shorts", "#cortes", "#clipforge"],
              media_url: c.file_path || c.video_url || "",
            });
          });
        });
        setClips(allClips);
      }
    } catch (err) {
      console.error("Failed to load clips library:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

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

  const handleDeleteClip = async (clipId: number) => {
    if (!confirm("Deseja realmente excluir este corte?")) return;
    try {
      await fetch(`${getApiHost()}/api/v1/clips/${clipId}`, { method: "DELETE" });
      setClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch (e) {
      console.error("Error deleting clip:", e);
    }
  };

  const filteredClips = selectedProjectId === "all"
    ? clips
    : clips.filter((c: any) => {
        const proj = projects.find((p) => String(p.id) === selectedProjectId);
        return (proj?.clips || []).some((pc: any) => pc.id === c.id);
      });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-[#0c0d14] rounded-2xl border border-white/10 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
              Biblioteca
            </span>
            <span className="text-xs text-gray-400 font-medium">{clips.length} Cortes Salvos</span>
          </div>
          <h2 className="text-xl font-bold text-white">Histórico de Cortes</h2>
          <p className="text-xs text-gray-400">Acesse todos os cortes gerados, baixe em MP4 ou exporte para Premiere/DaVinci.</p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            aria-label="Filtrar por Projeto"
            className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition-all"
          >
            <option value="all">Todos os Projetos ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.title || `Projeto #${p.id}`}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchLibrary}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            title="Atualizar Biblioteca"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
          <p className="text-xs text-gray-400">Carregando cortes da biblioteca...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredClips.length === 0 && (
        <div className="py-20 text-center space-y-3 bg-[#0c0d14] rounded-2xl border border-white/5 p-8">
          <Film className="w-10 h-10 text-gray-600 mx-auto" />
          <h3 className="font-semibold text-white text-sm">Nenhum corte encontrado</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Gere seus primeiros cortes enviando um vídeo na aba principal.
          </p>
        </div>
      )}

      {/* Clips Grid */}
      {!isLoading && filteredClips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClips.map((clip) => {
            const videoSrc = resolveVideoUrl(clip.media_url);
            const isMenuOpen = openExportMenuId === clip.id;

            return (
              <div
                key={clip.id}
                className="bg-[#0e1017] rounded-2xl border border-white/10 hover:border-violet-500/30 transition-all flex flex-col overflow-hidden shadow-lg"
              >
                {/* Score & Duration */}
                <div className="px-4 py-2.5 flex items-center justify-between bg-black/30 border-b border-white/5">
                  <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-bold">
                    <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                    <span>Score: {clip.viral_score}/100</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono text-gray-400">{clip.duration}s</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteClip(clip.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors p-1"
                      title="Excluir Corte"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                      <Clock className="w-8 h-8 text-gray-600 mx-auto" />
                      <p className="text-xs font-bold text-gray-400">{clip.title}</p>
                      <p className="text-[10px] text-gray-600">{clip.start_time}s até {clip.end_time}s</p>
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-[#0e1017]">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">
                      {clip.title}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {clip.hook_summary}
                    </p>
                  </div>

                  {/* Actions */}
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

                    {/* Export Dropdown */}
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
      )}

    </div>
  );
}

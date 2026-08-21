"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import MediaImporter, { VideoMetadata } from "@/components/MediaImporter";
import PipelineProgress from "@/components/PipelineProgress";
import PlaysquadClipGallery, { ClipItem } from "@/components/PlaysquadClipGallery";
import ClipsLibrary from "@/components/ClipsLibrary";
import { useAppStore } from "@/store/useAppStore";
import { useWebSocket } from "@/lib/useWebSocket";
import { Sparkles, Film } from "lucide-react";

export default function HomePage() {
  const [apiKey, setApiKey] = useState("");
  const [activeTab, setActiveTab] = useState<"create" | "library">("create");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Global Zustand Store
  const processingStatus = useAppStore((state) => state.processingStatus);
  const statusMessage = useAppStore((state) => state.statusMessage);
  const progress = useAppStore((state) => state.progress);
  const clips = useAppStore((state) => state.clips);
  const setClips = useAppStore((state) => state.setClips);
  const updateProgress = useAppStore((state) => state.updateProgress);

  // Hook up WebSocket for real-time live events from Go Gateway
  useWebSocket(activeProjectId);

  // Poll fallback / State hydration for project
  useEffect(() => {
    if (!activeProjectId || processingStatus === "COMPLETED" || processingStatus === "FAILED") return;

    const interval = setInterval(async () => {
      try {
        const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiHost}/api/v1/projects/${activeProjectId}`);
        if (!res.ok) return;

        const project = await res.json();
        if (project) {
          if (project.status === "COMPLETED") {
            const mappedClips: any[] = (project.clips || []).map((c: any) => ({
              id: c.id,
              title: c.title,
              description: c.description || "Gancho de alta retenção",
              score: Math.round(c.score || 95),
              start_time: c.start_time,
              end_time: c.end_time,
              video_url: c.file_path || c.video_url || "",
            }));
            setClips(mappedClips);
            updateProgress("COMPLETED", "Todos os cortes foram gerados com sucesso!", 100);
            setIsLoading(false);
            clearInterval(interval);
          } else if (project.status === "FAILED") {
            updateProgress("FAILED", "Falha no processamento do vídeo", 0);
            setIsLoading(false);
            clearInterval(interval);
          } else if (project.status && project.status !== processingStatus) {
            updateProgress(project.status as any, "Processando vídeo...", progress || 30);
          }
        }
      } catch (err) {
        console.error("Error polling project status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeProjectId, processingStatus, progress, setClips, updateProgress]);

  const handleStartProcess = async (params: {
    mode: "file" | "url";
    file?: File;
    url?: string;
    info?: VideoMetadata;
    aspectRatio: string;
    subtitleStyle: string;
    clipQuantity: number;
    prompt: string;
  }) => {
    setIsLoading(true);
    setVideoInfo(params.info || null);
    updateProgress("UPLOADING", "Enviando mídia para o servidor...", 10);

    const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    try {
      if (params.mode === "file" && params.file) {
        const formData = new FormData();
        formData.append("file", params.file);
        formData.append("title", params.file.name.replace(/\.[^/.]+$/, ""));
        formData.append("prompt", params.prompt);
        formData.append("aspect_ratio", params.aspectRatio);
        formData.append("subtitle_style", params.subtitleStyle);
        formData.append("clip_quantity", String(params.clipQuantity));

        const res = await fetch(`${apiHost}/api/v1/projects`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Falha no upload do arquivo");

        const data = await res.json();
        const pid = String(data.id || data.project_id);
        setActiveProjectId(pid);
        updateProgress("PREPROCESSING", "Vídeo recebido! Extraindo áudio e iniciando análise...", 20);
      } else if (params.mode === "url" && params.url) {
        const res = await fetch(`${apiHost}/api/v1/process-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: params.url,
            aspect_ratio: params.aspectRatio,
            subtitle_style: params.subtitleStyle,
            clip_quantity: params.clipQuantity,
            prompt: params.prompt,
          }),
        });

        if (!res.ok) throw new Error("Falha ao iniciar processamento da URL");

        const data = await res.json();
        const pid = String(data.project_id || data.project?.id || data.id);
        setActiveProjectId(pid);
        updateProgress("PREPROCESSING", "Baixando vídeo e extraindo áudio...", 20);
      }
    } catch (err: any) {
      console.error("Failed to start process:", err);
      updateProgress("FAILED", err.message || "Erro ao conectar com o servidor", 0);
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeProjectId) return;
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiHost}/api/v1/projects/${activeProjectId}/cancel`, { method: "POST" });
    } catch (e) {
      console.error("Cancel error", e);
    }
    updateProgress("IDLE", "", 0);
    setIsLoading(false);
    setActiveProjectId(null);
  };

  // Map clips from store to gallery format
  const galleryClips: ClipItem[] = (clips || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    hook_summary: c.description || "Gancho viral de alta retenção",
    start_time: c.start_time || 0,
    end_time: c.end_time || 30,
    duration: Math.round(((c.end_time || 30) - (c.start_time || 0)) * 10) / 10,
    viral_score: Math.round(c.score || 95),
    suggested_captions: c.description || "",
    suggested_hashtags: ["#viral", "#shorts", "#cortes", "#clipforge"],
    media_url: c.video_url || c.file_path || "",
  }));

  const isProcessing = processingStatus !== "IDLE" && processingStatus !== "COMPLETED" && processingStatus !== "FAILED";

  return (
    <div className="min-h-screen bg-[#07080d] text-gray-100 flex flex-col antialiased selection:bg-violet-600 selection:text-white">
      
      {/* Navigation */}
      <Navbar apiKey={apiKey} setApiKey={setApiKey} />

      {/* Top Tab Switcher */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center space-x-2 bg-[#0e1017] p-1.5 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "create"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Criar Cortes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "library"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Biblioteca de Cortes</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        
        {/* Tab 1: Create Clips */}
        {activeTab === "create" && (
          <>
            {/* Step 1: Media Importer (Upload or URL) */}
            {!isProcessing && processingStatus !== "COMPLETED" && (
              <MediaImporter
                onStartProcess={handleStartProcess}
                isLoading={isLoading}
              />
            )}

            {/* Step 2: Live Real-time Progress */}
            {isProcessing && (
              <PipelineProgress
                status={processingStatus}
                progress={progress}
                stepMessage={statusMessage}
                onCancel={handleCancel}
              />
            )}

            {/* Step 3: Generated Clips Showcase */}
            {processingStatus === "COMPLETED" && galleryClips.length > 0 && (
              <PlaysquadClipGallery
                clips={galleryClips}
                videoTitle={videoInfo?.title}
              />
            )}

            {/* Error State */}
            {processingStatus === "FAILED" && (
              <div className="max-w-xl mx-auto bg-red-950/20 border border-red-500/30 rounded-3xl p-6 text-center space-y-4 shadow-xl">
                <h3 className="font-bold text-red-400 text-base">Falha no Processamento</h3>
                <p className="text-xs text-gray-300">{statusMessage || "Ocorreu um erro ao processar o vídeo."}</p>
                <button
                  type="button"
                  onClick={() => {
                    updateProgress("IDLE", "", 0);
                    setIsLoading(false);
                    setActiveProjectId(null);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  Tentar Novamente
                </button>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Library */}
        {activeTab === "library" && <ClipsLibrary />}

      </main>

      {/* Modern Minimal Footer */}
      <footer className="border-t border-white/5 py-6 px-6 text-center text-xs text-gray-500 space-y-1">
        <p>ClipForge AI &bull; Cloud AI Video Engine</p>
      </footer>

    </div>
  );
}

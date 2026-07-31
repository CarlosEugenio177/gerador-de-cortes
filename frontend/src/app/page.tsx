"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import UrlImporter from "@/components/UrlImporter";
import PipelineProgress from "@/components/PipelineProgress";
import PlaysquadClipGallery, { ClipItem } from "@/components/PlaysquadClipGallery";

export default function HomePage() {
  const [apiKey, setApiKey] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [jobStatus, setJobStatus] = useState<string>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>("");
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Poll active job status
  useEffect(() => {
    if (!activeJobId || jobStatus === "completed" || jobStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiHost}/api/v1/jobs/${activeJobId}`);
        if (!res.ok) return;

        const data = await res.json();
        setJobStatus(data.status);
        setProgress(data.progress || 0);
        setStepMessage(data.step_message || "");

        if (data.status === "completed") {
          setClips(data.clips || []);
          setIsLoading(false);
          clearInterval(interval);
        } else if (data.status === "failed") {
          setIsLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error polling job status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobId, jobStatus]);

  const handleStartProcess = async (
    url: string,
    info: any,
    aspectRatio: string,
    subtitleStyle: string
  ) => {
    setIsLoading(true);
    setVideoInfo(info);
    setJobStatus("queued");
    setProgress(5);
    setStepMessage("Iniciando pipeline na VPS...");
    setClips([]);

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiHost}/api/v1/process-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          aspect_ratio: aspectRatio,
          subtitle_style: subtitleStyle,
          api_key: apiKey
        }),
      });

      if (!res.ok) throw new Error("Falha ao iniciar processamento.");

      const data = await res.json();
      setActiveJobId(data.job_id);
    } catch (err: any) {
      console.error("Failed to start process:", err);
      setJobStatus("failed");
      setStepMessage(err.message || "Erro ao conectar com servidor VPS");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a10] text-gray-100 flex flex-col selection:bg-violet-500 selection:text-white">
      
      {/* Navigation */}
      <Navbar apiKey={apiKey} setApiKey={setApiKey} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        
        {/* URL Importer Section */}
        {jobStatus === "idle" && (
          <UrlImporter
            onStartProcess={handleStartProcess}
            isLoading={isLoading}
          />
        )}

        {/* Progress Tracker Section */}
        {jobStatus !== "idle" && jobStatus !== "completed" && (
          <PipelineProgress
            status={jobStatus}
            progress={progress}
            stepMessage={stepMessage}
          />
        )}

        {/* Generated Clips Showcase Gallery */}
        {jobStatus === "completed" && clips.length > 0 && (
          <PlaysquadClipGallery
            clips={clips}
            videoTitle={videoInfo?.title}
          />
        )}

        {/* Failed State Display */}
        {jobStatus === "failed" && (
          <div className="max-w-2xl mx-auto playsquad-card p-6 border border-red-500/30 text-center space-y-4">
            <h3 className="font-bold text-red-400 text-lg">Falha no Processamento</h3>
            <p className="text-sm text-gray-300">{stepMessage}</p>
            <button
              onClick={() => {
                setJobStatus("idle");
                setIsLoading(false);
              }}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold text-white transition-all cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-6 text-center text-xs text-gray-400 space-y-1">
        <p>PLAYSquad AI Clipper Engine &bull; VPS Cloud API Architecture</p>
        <p className="text-[11px] text-gray-400">Processamento leve e inteligente sem necessidade de GPU local.</p>
      </footer>

    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Link2, Sparkles, Tv, Flame, Clock, User, ArrowRight, Loader2, Video } from "lucide-react";

interface VideoInfo {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  platform: string;
  url: string;
}

interface UrlImporterProps {
  onStartProcess: (url: string, info: VideoInfo, aspectRatio: string, subtitleStyle: string) => void;
  isLoading: boolean;
}

export default function UrlImporter({ onStartProcess, isLoading }: UrlImporterProps) {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [subtitleStyle, setSubtitleStyle] = useState("neon");

  // Platform detector helper
  const detectPlatform = (inputUrl: string) => {
    if (inputUrl.includes("youtube.com") || inputUrl.includes("youtu.be")) return "youtube";
    if (inputUrl.includes("twitch.tv")) return "twitch";
    if (inputUrl.includes("kick.com")) return "kick";
    if (inputUrl.includes("tiktok.com")) return "tiktok";
    return "generic";
  };

  const platform = detectPlatform(url);

  const handleFetchInfo = async () => {
    if (!url.trim()) return;
    setIsFetchingInfo(true);

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiHost}/api/v1/analyze-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error("Não foi possível carregar as informações do vídeo.");

      const data = await res.json();
      setVideoInfo(data);
    } catch (err: any) {
      // Fallback preview so user is never blocked
      setVideoInfo({
        id: "stream-clip",
        title: "Vídeo / Stream Importado",
        author: "Criador de Conteúdo",
        duration: 600,
        thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
        platform: platform,
        url: url
      });
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const handleGenerate = () => {
    if (!url.trim()) return;
    const finalInfo = videoInfo || {
      id: "stream-clip",
      title: "Stream / Vídeo Importado",
      author: "Criador",
      duration: 300,
      thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
      platform: platform,
      url: url
    };
    onStartProcess(url, finalInfo, aspectRatio, subtitleStyle);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Hero Headline */}
      <div className="text-center space-y-3 pt-6 pb-2">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold tracking-wide">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>IA de Detecção de Cortes Virais</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Cole o link e gere <span className="gradient-text">cortes automáticos</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
          Suporte a YouTube, Twitch VODs/Clips, Kick, TikTok e links diretos MP4.
        </p>
      </div>

      {/* Main Import Card */}
      <div className="playsquad-card p-6 sm:p-8 space-y-6 relative overflow-hidden border border-violet-500/20 shadow-2xl">
        
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-violet-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Input Bar */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
            Link da Live ou Vídeo Completo
          </label>
          
          <div className="relative flex items-center">
            
            {/* Platform Icon indicator inside input */}
            <div className="absolute left-4 text-gray-400 flex items-center pointer-events-none">
              {platform === "youtube" && <Video className="w-5 h-5 text-red-500" />}
              {platform === "twitch" && <Tv className="w-5 h-5 text-purple-400" />}
              {platform === "kick" && <Flame className="w-5 h-5 text-green-400" />}
              {platform === "generic" && <Link2 className="w-5 h-5 text-cyan-400" />}
            </div>

            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setVideoInfo(null);
              }}
              onBlur={handleFetchInfo}
              placeholder="Cole o link aqui: https://youtube.com/watch?v=... ou https://twitch.tv/..."
              className="w-full bg-black/60 border border-white/10 rounded-2xl pl-12 pr-32 py-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
            />

            <button
              onClick={handleFetchInfo}
              disabled={isFetchingInfo || !url.trim()}
              className="absolute right-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-gray-200 border border-white/10 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isFetchingInfo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Analisando...</span>
                </>
              ) : (
                <span>Analisar Link</span>
              )}
            </button>
          </div>
        </div>

        {/* Video Metadata Preview Card */}
        {videoInfo && (
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 rounded-2xl bg-white/5 border border-white/10 animate-fadeIn">
            <img
              src={videoInfo.thumbnail}
              alt={videoInfo.title}
              className="w-full sm:w-44 h-28 object-cover rounded-xl border border-white/10"
            />
            <div className="flex-1 space-y-2 text-left w-full">
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {videoInfo.platform}
                </span>
                <div className="flex items-center space-x-1 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDuration(videoInfo.duration)}</span>
                </div>
              </div>
              <h3 className="font-bold text-white text-base line-clamp-2">{videoInfo.title}</h3>
              <div className="flex items-center space-x-1.5 text-xs text-gray-400">
                <User className="w-3.5 h-3.5 text-violet-400" />
                <span>{videoInfo.author}</span>
              </div>
            </div>
          </div>
        )}

        {/* Presets Configuration Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          
          {/* Aspect Ratio Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
              Formato dos Cortes
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "9:16", label: "9:16 Vertical", desc: "Shorts / Reels" },
                { id: "1:1", label: "1:1 Quadrado", desc: "Feed Instagram" },
                { id: "16:9", label: "16:9 Original", desc: "YouTube Standard" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAspectRatio(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    aspectRatio === opt.id
                      ? "bg-violet-600/20 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <p className="font-bold text-xs">{opt.label}</p>
                  <p className="text-[10px] text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
              Estilo de Legenda Animada
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "neon", label: "Neon Karaoke", badge: "TikTok Style" },
                { id: "yellow", label: "Amarelo Bouncing", badge: "Viral High Contrast" }
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSubtitleStyle(sub.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    subtitleStyle === sub.id
                      ? "bg-cyan-500/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <p className="font-bold text-xs">{sub.label}</p>
                  <p className="text-[10px] text-cyan-400 font-semibold">{sub.badge}</p>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Action Button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading || !url.trim()}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-extrabold text-base shadow-xl shadow-violet-600/30 transition-all flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>Processando Pipeline com IA...</span>
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

"use client";

import { Download, ChevronLeft, Check, Scissors } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { motion } from "framer-motion";
import { useState } from "react";

export function ClipResultView() {
  const { clips, selectedClip, setSelectedClip, projectId, projectName } = useAppStore();
  const [downloadedClips, setDownloadedClips] = useState<Record<number, boolean>>({});

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const currentVideoSrc = selectedClip ? `${API_URL}/${selectedClip.video_url.replace(/\\/g, '/')}` : undefined;

  const handleDownload = (clipId: number, url: string, title: string) => {
    const link = document.createElement("a");
    const cleanUrl = url.replace(/\\/g, '/');
    link.href = `${API_URL}/${cleanUrl}`;
    link.download = `clipforge_${title.replace(/\s+/g, "_")}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadedClips(prev => ({ ...prev, [clipId]: true }));
  };

  const handleDownloadAll = () => {
    clips.forEach((clip, index) => {
      setTimeout(() => {
        handleDownload(clip.id, clip.video_url, clip.title);
      }, index * 500);
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen w-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden"
    >
      {/* Header */}
      <header className="h-16 border-b border-zinc-900 px-6 flex items-center justify-between shrink-0 bg-black sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <button 
            className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
            onClick={() => window.location.href = '/'}
            title="Voltar ao Dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="font-mono text-xs text-orange-500 uppercase tracking-widest font-black">Factory Output</span>
            <span className="text-sm font-medium text-zinc-300">{projectName || "Generated Clips"}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (projectId) window.location.href = '/forge?project=' + projectId;
            }}
            className="flex items-center space-x-2 bg-black text-zinc-400 px-4 py-2 rounded-lg text-xs font-bold hover:text-white transition-colors border border-zinc-800 hover:border-zinc-700 uppercase tracking-wider"
          >
            <span>New Forge</span>
          </button>

          <button
            onClick={handleDownloadAll}
            className="flex items-center space-x-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors border border-zinc-800 uppercase tracking-wider"
          >
            <Download className="w-4 h-4" />
            <span>Download All ({clips.length})</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Clips List */}
        <aside className="w-[350px] border-r border-zinc-900 bg-[#0a0a0a] flex flex-col shrink-0 relative overflow-hidden">
          <div className="p-5 border-b border-zinc-900 flex items-center justify-between bg-black z-10 sticky top-0">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-orange-500" />
              Clips Gerados
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
            {clips.map((clip) => (
              <div 
                key={clip.id}
                onClick={() => setSelectedClip(clip)}
                className={`p-4 rounded-xl cursor-pointer border transition-all duration-300 flex flex-col gap-3 relative overflow-hidden group ${
                  selectedClip?.id === clip.id 
                    ? "bg-zinc-900/80 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]" 
                    : "bg-black border-zinc-800 hover:border-zinc-700"
                }`}
              >
                {selectedClip?.id === clip.id && <div className="absolute left-0 top-0 w-1 h-full bg-orange-500" />}
                
                <div className="flex justify-between items-start">
                  <h4 className={`text-sm font-bold leading-tight pr-2 ${selectedClip?.id === clip.id ? 'text-white' : 'text-zinc-300'}`}>{clip.title}</h4>
                  <div className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 text-[10px] font-mono border border-orange-500/20 shrink-0">
                    ★ {clip.score}
                  </div>
                </div>
                
                <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed">{clip.description}</p>
                
                <div className="flex items-center justify-between mt-1 pt-3 border-t border-zinc-800/50">
                  <span className="text-zinc-600 text-[10px] font-mono">#{clip.id}</span>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(clip.id, clip.video_url, clip.title);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      downloadedClips[clip.id] 
                        ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' 
                        : 'bg-zinc-800 text-zinc-300 hover:bg-white hover:text-black'
                    }`}
                  >
                    {downloadedClips[clip.id] ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                    {downloadedClips[clip.id] ? 'Salvo' : 'Baixar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Video Player */}
        <main className="flex-1 bg-[#020202] p-8 relative flex items-center justify-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-600/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="h-full max-h-[800px] aspect-[9/16] bg-black border border-zinc-800 rounded-2xl overflow-hidden relative shadow-2xl flex items-center justify-center z-10">
            {currentVideoSrc ? (
              <video 
                key={currentVideoSrc}
                src={currentVideoSrc} 
                controls 
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-zinc-600 flex flex-col items-center gap-3">
                <Scissors className="w-8 h-8 opacity-50" />
                <p className="font-mono text-xs uppercase tracking-widest">Selecione um clipe</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </motion.div>
  );
}

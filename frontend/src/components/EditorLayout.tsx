"use client";

import { MonitorPlay, Download, ChevronLeft, RefreshCw } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { motion } from "framer-motion";
import { OssPopup } from "./OssPopup";
import { useEffect, useState } from "react";

import { StyleEditor } from "./StyleEditor";
import { TranscriptEditor } from "./TranscriptEditor";

export function EditorLayout() {
  const { clips, selectedClip, setSelectedClip, showOssPopup, setShowOssPopup, projectId, reprocessProject, processingStatus, videoUrl, advancedMode } = useAppStore();
  
  const currentVideoSrc = (!advancedMode 
    ? (selectedClip ? `http://localhost:8000/${selectedClip.video_url.replace(/\\/g, '/')}` : undefined)
    : videoUrl) || undefined;

  const handleDownloadAll = () => {
    clips.forEach((clip, index) => {
      const link = document.createElement("a");
      link.href = `http://localhost:8000/${clip.video_url}`;
      link.download = `clipforge_${clip.title.replace(/\\s+/g, "_")}.mp4`;
      document.body.appendChild(link);
      setTimeout(() => {
        link.click();
        document.body.removeChild(link);
      }, index * 500);
    });
  };

  useEffect(() => {
    if (showOssPopup) {
      const timer = setTimeout(() => {
        setShowOssPopup(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showOssPopup, setShowOssPopup]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen w-screen bg-[#000000] text-zinc-100 flex flex-col font-sans relative"
    >
      {showOssPopup && <OssPopup />}

      {/* Top Header */}
      <header className="h-14 border-b border-zinc-900 px-6 flex items-center justify-between shrink-0 z-10 relative">
        <div className="flex items-center space-x-4">
          <button 
            className="p-1 hover:bg-zinc-900 rounded transition-colors text-zinc-400 hover:text-white"
            onClick={() => window.location.href = '/'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">ClipForge Studio</span>
            <span className="text-sm font-medium">{!advancedMode ? (selectedClip?.title || "Project Result") : "Vídeo Original"}</span>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="absolute left-1/2 -translate-x-1/2 flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
          <button 
            onClick={() => {
              if (advancedMode) useAppStore.getState().toggleAdvancedMode();
            }}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              !advancedMode ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Quick Mode
          </button>
          <button 
            onClick={() => {
              if (!advancedMode) useAppStore.getState().toggleAdvancedMode();
            }}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              advancedMode ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Pro Mode
          </button>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (projectId) {
                window.location.href = '/forge?project=' + projectId;
              }
            }}
            disabled={processingStatus === 'ANALYZING'}
            className="flex items-center space-x-2 bg-zinc-800 text-zinc-300 px-4 py-1.5 rounded text-xs font-semibold hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${processingStatus === 'ANALYZING' ? 'animate-spin' : ''}`} />
            <span>Gerar Novos Cortes</span>
          </button>

          <button
            onClick={handleDownloadAll}
            className="flex items-center space-x-2 bg-zinc-800 text-zinc-300 px-4 py-1.5 rounded text-xs font-semibold hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700"
          >
            <Download className="w-4 h-4" />
            <span>Export All ({clips.length})</span>
          </button>

          <a
            href={currentVideoSrc}
            download
            className="flex items-center space-x-2 bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:from-orange-500 hover:to-red-500 transition-colors shadow-[0_0_10px_rgba(234,88,12,0.3)] border border-orange-500/50"
          >
            <Download className="w-4 h-4" />
            <span>Export Current</span>
          </a>
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden z-10 relative">
        
        {/* Left Sidebar: Clips Feed or Tools */}
        <aside className="w-80 border-r border-zinc-900 bg-[#050505] flex flex-col shrink-0">
          {!advancedMode ? (
            <>
              <div className="p-4 border-b border-zinc-900">
                <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500">Generated Clips ({clips.length})</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {clips.map((clip, idx) => (
                  <button
                    key={clip.id}
                    onClick={() => setSelectedClip(clip)}
                    className={`w-full text-left p-4 rounded-md flex flex-col justify-between transition-all border ${
                      selectedClip?.id === clip.id 
                        ? "bg-zinc-900 border-zinc-700 shadow-sm" 
                        : "bg-transparent border-transparent hover:bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-zinc-100 text-sm font-medium leading-tight pr-2">{clip.title}</h4>
                      <div className="bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 border border-green-500/20">
                        ★ {clip.score}
                      </div>
                    </div>
                    <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed mb-3">{clip.description}</p>
                    
                    <span className="text-zinc-600 text-[10px] font-mono">CLIP 0{idx + 1}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <StyleEditor />
          )}
        </aside>

        {/* Center: Main Canvas (Player) */}
        <main className="flex-1 flex flex-col bg-[#020202] p-8 relative">
          <div className="flex-1 flex items-center justify-center relative bg-black border border-zinc-900 rounded-lg overflow-hidden shadow-2xl">
            {currentVideoSrc ? (
              <video 
                key={currentVideoSrc}
                src={currentVideoSrc} 
                controls 
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-600">
                <MonitorPlay className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-mono text-sm">Select a clip to preview</p>
              </div>
            )}
          </div>
        </main>
        
        {/* Right Sidebar: Transcript Editor */}
        {advancedMode && (
          <aside className="w-96 border-l border-zinc-900 bg-[#050505] flex flex-col shrink-0">
            <TranscriptEditor />
          </aside>
        )}
      </div>
    </motion.div>
  );
}

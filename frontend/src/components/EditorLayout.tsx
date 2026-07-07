"use client";

import { MonitorPlay, Download, ChevronLeft, RefreshCw, Scissors } from "lucide-react";
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
        <aside className="w-80 border-r border-zinc-900 bg-[#050505] flex flex-col shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-[50px] pointer-events-none" />
          
          {!advancedMode ? (
            <>
              <div className="p-4 border-b border-zinc-900 bg-[#0a0a0a] sticky top-0 z-10 flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                  <Scissors className="w-3 h-3 text-orange-500" />
                  Generated Clips
                </h2>
                <span className="text-[10px] text-orange-500 font-mono bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">{clips.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="relative pl-3 border-l-2 border-zinc-900 space-y-6">
                  {clips.map((clip, idx) => (
                    <div key={clip.id} className="relative">
                      {/* Timeline Node */}
                      <div className={`absolute -left-[17px] top-4 w-3 h-3 rounded-full border-2 border-[#050505] ${
                        selectedClip?.id === clip.id ? "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" : "bg-zinc-700"
                      }`} />
                      
                      <button
                        onClick={() => setSelectedClip(clip)}
                        className={`w-full text-left p-4 rounded-xl flex flex-col justify-between transition-all duration-300 border relative overflow-hidden group ${
                          selectedClip?.id === clip.id 
                            ? "bg-gradient-to-b from-zinc-900 to-[#0a0a0a] border-orange-500/50 shadow-[0_5px_15px_rgba(249,115,22,0.1)]" 
                            : "bg-[#0a0a0a] border-zinc-800 hover:border-zinc-700 hover:bg-[#111]"
                        }`}
                      >
                        {selectedClip?.id === clip.id && <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-600 to-amber-400" />}
                        
                        <div className="flex justify-between items-start mb-2 relative z-10">
                          <h4 className={`text-sm font-bold leading-tight pr-2 ${selectedClip?.id === clip.id ? 'text-orange-50' : 'text-zinc-300'}`}>{clip.title}</h4>
                          <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 border ${
                            clip.score >= 90 ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' : 'bg-green-500/10 text-green-500 border-green-500/20'
                          }`}>
                            ★ {clip.score}
                          </div>
                        </div>
                        <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed mb-3 relative z-10">{clip.description}</p>
                        
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800/50 relative z-10">
                          <span className="text-zinc-600 text-[9px] font-black tracking-widest uppercase">Version {(Math.floor(idx / 3)) + 1}</span>
                          <span className="text-zinc-700 text-[10px] font-mono">#{clip.id}</span>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
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

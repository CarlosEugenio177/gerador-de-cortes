"use client";

import { Upload, Play, MonitorPlay, Hammer, Flame, Anvil } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";

export function MediaViewer() {
  const { videoUrl, processingStatus, statusMessage, progress, setVideoFile, clips, selectedClip, setSelectedClip, projectId } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoFile(file, url); // Apenas salva no estado, NÃO aciona o backend ainda!
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const currentVideoSrc = selectedClip ? `${API_URL}/${selectedClip.video_url.replace(/\\/g, '/')}` : videoUrl || undefined;

  return (
    <div className="flex-1 flex bg-[#000000] relative overflow-hidden h-full">
      <AnimatePresence mode="wait">
        {(!videoUrl && !selectedClip && !projectId) ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center p-8"
          >
            <div className="flex flex-col items-center max-w-2xl w-full">
              <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`w-full border-2 border-dashed rounded-2xl p-20 flex flex-col items-center justify-center text-center transition-all duration-300 group relative overflow-hidden ${
                  isDragging ? "bg-[#0a0a0a] border-orange-500/50 scale-105" : "bg-gradient-to-b from-[#050505] to-[#0a0a0a] border-zinc-800 hover:border-zinc-700 hover:shadow-[0_0_50px_rgba(249,115,22,0.05)]"
                }`}
              >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay" />
                <input 
                  type="file" 
                  accept="video/mp4,video/quicktime" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                />
                
                <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-500 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                  <Upload className="w-8 h-8 text-zinc-500 group-hover:text-orange-500 transition-colors" />
                </div>
                
                <h3 className="text-2xl font-black text-zinc-200 uppercase tracking-widest mb-3 z-10">Upload Raw Material</h3>
                <p className="text-sm text-zinc-500 mb-10 max-w-sm z-10">Drag and drop your MP4 or MOV file here to begin the forging process.</p>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-8 py-3 bg-zinc-900 text-zinc-300 text-xs font-bold uppercase tracking-widest border border-zinc-800 rounded-lg hover:bg-white hover:text-black transition-colors z-10 shadow-lg"
                >
                  Select File
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex w-full h-full relative z-10"
          >
            {/* Esquerda: Player Principal */}
            <div className="flex-1 flex flex-col p-6 pr-0">
              {/* Header Viewer */}
              <div className="flex items-center justify-between mb-4 pr-6">
                <div className="flex items-center space-x-2">
                  <MonitorPlay className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-400 text-xs font-mono uppercase tracking-wider">
                    {selectedClip ? `Result: ${selectedClip.title}` : "Source Video"}
                  </span>
                </div>
                
                {/* Status Badge */}
                {processingStatus !== 'IDLE' && (
                  <div className="flex items-center px-4 py-1.5 bg-[#050505] border border-zinc-800 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ml-auto space-x-3">
                    <div className={`w-2 h-2 rounded-full ${processingStatus === 'COMPLETED' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] animate-pulse'}`} />
                    {processingStatus !== 'COMPLETED' && <span className="text-orange-500 font-bold text-xs">{progress}%</span>}
                    <span className={`text-zinc-400 text-[10px] font-bold uppercase tracking-widest ${processingStatus !== 'COMPLETED' ? 'border-l border-zinc-800 pl-3' : ''}`}>
                      {processingStatus === 'COMPLETED' ? 'Ready' : statusMessage}
                    </span>
                  </div>
                )}
              </div>

              {/* Main Video Container */}
              <div className="flex-1 rounded-xl overflow-hidden bg-gradient-to-b from-[#0a0a0a] to-[#050505] border border-zinc-900 relative mr-6 mb-6 flex items-center justify-center shadow-2xl">
                <video 
                  key={currentVideoSrc} // Force re-render when src changes
                  src={currentVideoSrc} 
                  controls 
                  autoPlay={!!selectedClip}
                  className="max-w-full max-h-full object-contain relative z-10"
                />
                
                {/* Progress Bar Overlay when processing */}
                {processingStatus !== 'IDLE' && processingStatus !== 'COMPLETED' && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
                    
                    <div className="relative mb-8 flex items-center justify-center">
                      <div className="absolute w-24 h-24 bg-orange-500/5 blur-[20px] rounded-full pointer-events-none" />
                      
                      <div className="relative flex flex-col items-center">
                        {/* Animated Minimal Hammer */}
                        <motion.div
                          animate={{ 
                            y: [0, -10, 0],
                            rotate: [0, -15, 0]
                          }}
                          transition={{ 
                            repeat: Infinity, 
                            duration: 1, 
                            ease: "easeInOut",
                            times: [0, 0.5, 1]
                          }}
                          className="origin-bottom-right text-[#D0D0D0] relative z-20 mb-1"
                        >
                          <Hammer strokeWidth={1.5} className="w-5 h-5 drop-shadow-[0_0_3px_rgba(249,115,22,0.3)]" />
                        </motion.div>
                        
                        {/* Minimal Anvil */}
                        <Anvil strokeWidth={1.5} className="w-6 h-6 text-[#D0D0D0] relative z-10" />

                        {/* Minimal Sparks */}
                        <motion.div
                          animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1, 0.5], y: [0, -8, 4], x: [0, -8, 12] }}
                          transition={{ repeat: Infinity, duration: 1, times: [0, 0.5, 1], ease: "easeOut" }}
                          className="absolute top-4 right-1 w-1 h-1 bg-orange-500 rounded-full blur-[1px] z-10 opacity-60"
                        />
                        <motion.div
                          animate={{ opacity: [0, 0.6, 0], scale: [0.3, 0.8, 0.3], y: [0, -12, 6], x: [0, 8, 15] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0.1, times: [0, 0.5, 1], ease: "easeOut" }}
                          className="absolute top-3 right-0 w-0.5 h-0.5 bg-orange-400 rounded-full blur-[0.5px] z-10 opacity-50"
                        />
                      </div>
                    </div>

                    <div className="w-64 h-1 bg-zinc-900 overflow-hidden mb-5 rounded-full relative border border-zinc-800/50">
                      <motion.div 
                        className="h-full bg-zinc-300 shadow-[0_0_8px_rgba(249,115,22,0.3)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "linear" }}
                      />
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <h3 className="text-sm font-medium tracking-[0.15em] text-[#D0D0D0] uppercase mb-1.5 flex items-center gap-2">
                        <Flame strokeWidth={1.5} className="w-3.5 h-3.5 text-zinc-500" />
                        Forging Video
                      </h3>
                      <p className="text-zinc-500 text-[10px] font-mono tracking-widest uppercase">{statusMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

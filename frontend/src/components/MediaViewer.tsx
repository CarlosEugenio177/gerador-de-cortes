"use client";

import { Upload, Play, MonitorPlay } from "lucide-react";
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

  const currentVideoSrc = selectedClip ? `http://localhost:8000/${selectedClip.video_url}` : videoUrl || undefined;

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
            <div className="flex flex-col items-center max-w-md w-full">
              <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`w-full border border-zinc-800 rounded-lg p-12 flex flex-col items-center justify-center text-center transition-all group ${
                  isDragging ? "bg-[#0a0a0a] border-zinc-500" : "bg-[#050505] hover:bg-[#0a0a0a]"
                }`}
              >
                <input 
                  type="file" 
                  accept="video/mp4,video/quicktime" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                />
                <Upload className="w-5 h-5 text-zinc-500 mb-4 group-hover:text-zinc-300 transition-colors" />
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Upload raw video</h3>
                <p className="text-xs text-zinc-600 mb-6">MP4 or MOV</p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 bg-zinc-900 text-zinc-300 text-xs font-mono border border-zinc-800 rounded hover:bg-zinc-800 hover:text-white transition-colors"
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
                {processingStatus !== 'idle' && (
                  <div className="flex items-center px-3 py-1 bg-[#0a0a0a] border border-zinc-800 rounded text-xs font-mono">
                    <div className={`w-1.5 h-1.5 rounded-full ${processingStatus === 'completed' ? 'bg-green-500' : 'bg-white animate-pulse'} mr-2`} />
                    {processingStatus !== 'completed' && <span className="text-zinc-300">{progress}%</span>}
                    <span className={`text-zinc-500 ${processingStatus !== 'completed' ? 'ml-2 border-l border-zinc-800 pl-2' : ''}`}>
                      {processingStatus === 'completed' ? 'Ready' : statusMessage}
                    </span>
                  </div>
                )}
              </div>

              {/* Main Video Container */}
              <div className="flex-1 rounded-md overflow-hidden bg-[#050505] border border-zinc-900 relative mr-6 mb-6 flex items-center justify-center">
                <video 
                  key={currentVideoSrc} // Force re-render when src changes
                  src={currentVideoSrc} 
                  controls 
                  autoPlay={!!selectedClip}
                  className="max-w-full max-h-full object-contain"
                />
                
                {/* Progress Bar Overlay when processing */}
                {processingStatus !== 'idle' && processingStatus !== 'completed' && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="w-64 h-1 bg-zinc-900 overflow-hidden mb-3">
                      <motion.div 
                        className="h-full bg-zinc-300"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "linear" }}
                      />
                    </div>
                    <p className="text-zinc-400 text-xs font-mono animate-pulse">{statusMessage}</p>
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

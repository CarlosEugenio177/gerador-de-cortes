"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export function ToastNotification() {
  const { processingStatus, statusMessage, updateProgress } = useAppStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (processingStatus === 'FAILED') {
      setVisible(true);
      // Auto-hide after 8 seconds
      const t = setTimeout(() => {
        setVisible(false);
        // We delay the state reset so the fade out animation completes
        setTimeout(() => updateProgress('IDLE', '', 0), 300);
      }, 8000);
      return () => clearTimeout(t);
    }
  }, [processingStatus, statusMessage, updateProgress]);

  if (!visible && processingStatus !== 'FAILED') return null;

  return (
    <div 
      className={`fixed top-6 right-6 z-50 transition-all duration-300 transform ${visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}
    >
      <div className="bg-black border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)] rounded-lg p-4 flex items-start max-w-sm backdrop-blur">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 shrink-0" />
        <div className="flex-1 mr-4">
          <h3 className="text-red-500 font-bold text-sm uppercase tracking-wider mb-1">System Alert</h3>
          <p className="text-zinc-300 text-xs">{statusMessage || "Unknown critical error occurred."}</p>
        </div>
        <button 
          onClick={() => { 
            setVisible(false); 
            setTimeout(() => updateProgress('IDLE', '', 0), 300); 
          }}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

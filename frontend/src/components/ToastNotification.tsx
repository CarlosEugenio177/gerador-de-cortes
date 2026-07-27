"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export function ToastNotification() {
  const { processingStatus, statusMessage, updateProgress } = useAppStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (processingStatus === 'FAILED' || processingStatus === 'COMPLETED') {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [processingStatus, statusMessage]);

  if (!visible || (processingStatus !== 'FAILED' && processingStatus !== 'COMPLETED')) return null;

  const isFailed = processingStatus === 'FAILED';

  return (
    <div 
      className={`fixed top-6 right-6 z-50 transition-all duration-300 transform ${visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}
    >
      <div className={`bg-black/90 border shadow-2xl rounded-xl p-4 flex items-start max-w-md backdrop-blur-md ${
        isFailed 
          ? 'border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.3)]' 
          : 'border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
      }`}>
        <AlertCircle className={`w-5 h-5 mt-0.5 mr-3 shrink-0 ${isFailed ? 'text-red-500' : 'text-emerald-400'}`} />
        <div className="flex-1 mr-4">
          <h3 className={`font-bold text-xs uppercase tracking-widest mb-1 ${isFailed ? 'text-red-500' : 'text-emerald-400'}`}>
            {isFailed ? 'Falha no Processamento' : 'Edição Concluída'}
          </h3>
          <p className="text-zinc-300 text-xs leading-relaxed">
            {statusMessage || (isFailed ? "Ocorreu um erro ao processar o vídeo." : "Seus cortes de vídeo foram gerados com sucesso!")}
          </p>
        </div>
        <button 
          onClick={() => setVisible(false)}
          className="text-zinc-500 hover:text-white transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

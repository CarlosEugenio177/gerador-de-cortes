"use client";

import React from "react";
import { Download, Mic, Brain, Film, CheckCircle2, Loader2, XCircle, Sliders } from "lucide-react";

interface PipelineProgressProps {
  status: string;
  progress: number;
  stepMessage: string;
  onCancel?: () => void;
}

export default function PipelineProgress({ status, progress, stepMessage, onCancel }: PipelineProgressProps) {
  const steps = [
    { id: "DOWNLOADING", label: "Download do Vídeo", icon: Download },
    { id: "PREPROCESSING", label: "Extração de Áudio", icon: Sliders },
    { id: "TRANSCRIBING", label: "Transcrição de Fala", icon: Mic },
    { id: "ANALYZING", label: "Ganchos Virais IA", icon: Brain },
    { id: "RENDERING", label: "Render 9:16 & Legendas", icon: Film }
  ];

  const getStepState = (stepId: string) => {
    const order = ["UPLOADING", "DOWNLOADING", "PREPROCESSING", "TRANSCRIBING", "ANALYZING", "RENDERING", "COMPLETED"];
    const currentIndex = order.indexOf(status.toUpperCase());
    const stepIndex = order.indexOf(stepId);

    // If uploading a file, mark downloading as completed/skipped
    if (status.toUpperCase() === "UPLOADING" && stepId === "DOWNLOADING") return "active";

    if (currentIndex > stepIndex || status.toUpperCase() === "COMPLETED") return "completed";
    if (currentIndex === stepIndex) return "active";
    return "pending";
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#0c0d14] rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6 shadow-xl animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[11px] uppercase font-bold tracking-wider text-cyan-400">Processamento em Tempo Real</span>
          </div>
          <h3 className="font-bold text-lg text-white">Criando seus Cortes Virais</h3>
          <p className="text-xs text-gray-400">{stepMessage || "Processando pipeline de IA..."}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="font-mono font-bold text-2xl text-cyan-400">{Math.min(100, Math.max(0, progress))}%</span>
          {onCancel && status.toUpperCase() !== "COMPLETED" && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 transition-all cursor-pointer"
              title="Cancelar Processamento"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/5">
        <div
          className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 rounded-full transition-all duration-300 shadow-sm"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>

      {/* Step Indicators Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
        {steps.map((step) => {
          const state = getStepState(step.id);
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border flex items-center space-x-2.5 transition-all ${
                state === "completed"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : state === "active"
                  ? "bg-violet-600/20 border-violet-500 text-white shadow-sm"
                  : "bg-white/5 border-white/5 text-gray-500"
              }`}
            >
              <div className="flex-shrink-0">
                {state === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : state === "active" ? (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-[11px] truncate">{step.label}</p>
                <p className="text-[9px] opacity-75 font-mono">
                  {state === "completed" ? "Concluído" : state === "active" ? "Executando..." : "Aguardando"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

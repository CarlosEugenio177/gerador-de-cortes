"use client";

import React from "react";
import { Download, Mic, Brain, Film, CheckCircle2, Loader2 } from "lucide-react";

interface PipelineProgressProps {
  status: string;
  progress: number;
  stepMessage: string;
}

export default function PipelineProgress({ status, progress, stepMessage }: PipelineProgressProps) {
  const steps = [
    { id: "downloading", label: "Download de Mídia", icon: Download },
    { id: "transcribing", label: "Transcrição Cloud API", icon: Mic },
    { id: "analyzing", label: "IA Viral Hooks (GPT-4o)", icon: Brain },
    { id: "rendering", label: "Renderização 9:16 & Legendas", icon: Film }
  ];

  const getStepState = (stepId: string) => {
    const order = ["queued", "downloading", "transcribing", "analyzing", "rendering", "completed"];
    const currentIndex = order.indexOf(status);
    const stepIndex = order.indexOf(stepId);

    if (currentIndex > stepIndex) return "completed";
    if (currentIndex === stepIndex) return "active";
    return "pending";
  };

  return (
    <div className="w-full max-w-4xl mx-auto playsquad-card p-6 border border-violet-500/30 space-y-6 animate-fadeIn">
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-white">Processando Vídeo em Nuvem</h3>
          <p className="text-xs text-gray-400">{stepMessage || "Iniciando processamento VPS..."}</p>
        </div>
        <div className="text-right">
          <span className="font-extrabold text-2xl text-cyan-400">{progress}%</span>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
        <div
          className="h-full bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-400 rounded-full transition-all duration-500 shadow-lg shadow-cyan-500/50"
          style={{ width: `${Math.max(progress, 5)}%` }}
        ></div>
      </div>

      {/* Step Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
        {steps.map((step) => {
          const state = getStepState(step.id);
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border flex items-center space-x-3 transition-all ${
                state === "completed"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : state === "active"
                  ? "bg-violet-600/20 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                  : "bg-white/5 border-white/10 text-gray-500"
              }`}
            >
              <div className="flex-shrink-0">
                {state === "completed" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : state === "active" ? (
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-xs truncate">{step.label}</p>
                <p className="text-[10px] opacity-75">
                  {state === "completed" ? "Concluído" : state === "active" ? "Processando..." : "Aguardando"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

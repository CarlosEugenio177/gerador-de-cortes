"use client";

import { useState } from "react";
import { Flame, Hammer, Scissors, Video, Settings, Play, Type, Settings2, ShieldAlert, FileText, ChevronLeft } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

const i18n = {
  en: {
    header: "Forge Controls",
    projectName: "Project Name",
    projectPlaceholder: "Enter project name...",
    aspectRatio: "Aspect Ratio",
    subtitleStyle: "Subtitle Style",
    processingMode: "Processing Mode",
    autoForge: "Auto Forge",
    autoForgeDesc: "Let AI find the most viral moments",
    hybridEdit: "Hybrid Edit",
    hybridEditDesc: "AI respects your duration constraints",
    manualCut: "Manual Cut",
    manualCutDesc: "You pick the exact timestamps on the timeline",
    clipQuantity: "Quantity of Clips",
    targetDuration: "Target Duration (minutes)",
    igniting: "Forging...",
    ignite: "Ignite Forge",
    fullEdit: "Full Video Edit",
    fullEditDesc: "Edit the entire video without cutting it",
    cancel: "Cancel"
  },
  pt: {
    header: "Controles da Forja",
    projectName: "Nome do Projeto",
    projectPlaceholder: "Digite o nome do projeto...",
    aspectRatio: "Proporção de Tela",
    subtitleStyle: "Estilo da Legenda",
    processingMode: "Modo de Processamento",
    autoForge: "Forja Automática",
    autoForgeDesc: "Deixe a IA encontrar os momentos virais",
    hybridEdit: "Edição Híbrida",
    hybridEditDesc: "A IA respeita seus limites de tempo",
    manualCut: "Corte Manual",
    manualCutDesc: "Você escolhe o tempo exato na timeline",
    clipQuantity: "Quantidade de Cortes",
    targetDuration: "Duração Alvo (minutos)",
    igniting: "Forjando...",
    ignite: "Ligar a Forja",
    fullEdit: "Edição Normal",
    fullEditDesc: "Edita o vídeo inteiro sem fazer cortes",
    cancel: "Cancelar"
  }
};

export function ForgeControls() {
  const { 
    isThinking, setThinking, videoFile, setProject, updateProgress, processingStatus,
    forgeAspectRatios, forgeSubtitleStyle, forgeMode, forgeClipQuantity, forgeDurationMins, forgeLanguage, setForgeSettings,
    projectName, setProjectName, projectId, reprocessProject, cancelProcessing, clips
  } = useAppStore();

  const t = i18n[forgeLanguage];
  const isProcessing = isThinking || (processingStatus !== 'IDLE' && processingStatus !== 'COMPLETED' && processingStatus !== 'FAILED');

  const handleForge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isThinking) return;

    if (!videoFile) {
      alert("Please upload a raw video first.");
      return;
    }

    setThinking(true);
    
    // Convert UI state into a prompt instruction for the LLM
    let promptInstruction = `video_formats: ${forgeAspectRatios.join(",")}, subtitle_style: ${forgeSubtitleStyle}, mode: ${forgeMode}`;
    if (forgeMode === 'FULL EDIT') {
      promptInstruction += `\n\nFULL_VIDEO_EDIT`;
    } else if (forgeMode !== 'MANUAL CUT') {
      promptInstruction += `\n\nduration_request: ${forgeDurationMins} minutes\nclip_quantity: ${forgeClipQuantity}`;
    }

    if (projectId) {
      // We are reprocessing an existing project
      await reprocessProject(projectId);
      setThinking(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", videoFile);
    
    // Use the custom project name, fallback to filename if empty
    const finalTitle = projectName.trim() !== "" ? projectName : videoFile.name.replace(/\.[^/.]+$/, "");
    formData.append("title", finalTitle);
    
    formData.append("prompt", promptInstruction);

    try {
      updateProgress('UPLOADING', 'IGNITING FORGE (Uploading video)...', 10);
      const res = await fetch("http://localhost:8000/api/v1/projects", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to create project");

      const project = await res.json();
      setProject(project.id);
      
    } catch (error) {
      console.error(error);
      updateProgress('FAILED', 'System Error: Core Meltdown', 0);
    } finally {
      setThinking(false);
    }
  };

  const toggleFormat = (val: string) => {
    let newFormats = [...forgeAspectRatios];
    if (newFormats.includes(val)) {
      if (newFormats.length > 1) newFormats = newFormats.filter(v => v !== val);
    } else {
      newFormats.push(val);
    }
    setForgeSettings({ forgeAspectRatios: newFormats });
  };

  const renderToggle = (label: string, icon: React.ReactNode, value: string, current: string, setter: (val: string) => void) => (
    <button
      type="button"
      disabled={isProcessing}
      onClick={() => setter(value)}
      className={`flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-md border transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} ${
        current === value || (Array.isArray(current) && current.includes(value))
          ? 'bg-zinc-900 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)] text-orange-500' 
          : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
      }`}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-[10px] font-bold tracking-wider uppercase text-center">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#050505] relative">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-900 z-10 bg-black sticky top-0 shrink-0 shadow-md">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (projectId && clips.length > 0) {
                window.location.href = `/editor/${projectId}`;
              } else {
                window.location.href = '/';
              }
            }}
            className="p-1 hover:bg-zinc-900 rounded transition-colors text-zinc-400 hover:text-white"
            title={projectId && clips.length > 0 ? "Voltar ao Studio" : "Voltar ao Dashboard"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center">
            <Hammer className="w-4 h-4 text-orange-500 mr-2" />
            <h2 className="text-xs font-black text-white tracking-widest uppercase">{t.header}</h2>
          </div>
        </div>
        <div className="flex space-x-1 border border-zinc-800 rounded p-0.5 bg-black">
          <button 
            disabled={isProcessing}
            onClick={() => setForgeSettings({ forgeLanguage: 'en' })} 
            className={`px-2 py-1 text-[9px] font-bold rounded ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} ${forgeLanguage === 'en' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            EN
          </button>
          <button 
            disabled={isProcessing}
            onClick={() => setForgeSettings({ forgeLanguage: 'pt' })} 
            className={`px-2 py-1 text-[9px] font-bold rounded ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} ${forgeLanguage === 'pt' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            PT
          </button>
        </div>
      </div>

      {/* Controls Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Project Name */}
        <div className="space-y-3">
          <label className="flex items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <FileText className="w-3 h-3 mr-2 text-zinc-500" />
            {t.projectName}
          </label>
          <input
            type="text"
            disabled={isProcessing}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={t.projectPlaceholder}
            className={`w-full bg-black border border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-3">
          <label className="flex items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <Video className="w-3 h-3 mr-2 text-zinc-500" />
            {t.aspectRatio}
          </label>
          <div className="flex space-x-2">
            {renderToggle("9:16 (TikTok)", <div className="w-3 h-5 border-2 rounded-sm border-current" />, "9:16", forgeAspectRatios as any, toggleFormat)}
            {renderToggle("1:1 (Insta)", <div className="w-4 h-4 border-2 rounded-sm border-current" />, "1:1", forgeAspectRatios as any, toggleFormat)}
            {renderToggle("16:9 (YT)", <div className="w-5 h-3 border-2 rounded-sm border-current" />, "16:9", forgeAspectRatios as any, toggleFormat)}
          </div>
        </div>

        {/* Subtitle Style */}
        <div className="space-y-3">
          <label className="flex items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <Type className="w-3 h-3 mr-2 text-zinc-500" />
            {t.subtitleStyle}
          </label>
          <div className="flex space-x-2">
            {renderToggle("Fire", <Flame className="w-4 h-4" />, "Fire", forgeSubtitleStyle, (val) => setForgeSettings({ forgeSubtitleStyle: val }))}
            {renderToggle("Steel", <Settings className="w-4 h-4" />, "Steel", forgeSubtitleStyle, (val) => setForgeSettings({ forgeSubtitleStyle: val }))}
            {renderToggle("Ember", <Flame className="w-4 h-4" />, "Ember", forgeSubtitleStyle, (val) => setForgeSettings({ forgeSubtitleStyle: val }))}
          </div>
        </div>

        {/* Forge Mode */}
        <div className="space-y-3">
          <label className="flex items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <Settings2 className="w-3 h-3 mr-2 text-zinc-500" />
            {t.processingMode}
          </label>
          <div className="grid grid-cols-1 gap-2">
            <button
              disabled={isProcessing}
              onClick={() => setForgeSettings({ forgeMode: 'AUTO FORGE' })}
              className={`flex items-center p-3 rounded border transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} ${forgeMode === 'AUTO FORGE' ? 'bg-orange-500/10 border-orange-500/50 text-orange-500' : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
            >
              <Flame className="w-4 h-4 mr-3" />
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-wider">{t.autoForge}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{t.autoForgeDesc}</div>
              </div>
            </button>
            <button
              disabled={isProcessing}
              onClick={() => setForgeSettings({ forgeMode: 'HYBRID' })}
              className={`flex items-center p-3 rounded border transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} ${forgeMode === 'HYBRID' ? 'bg-zinc-800/50 border-zinc-500/50 text-white' : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
            >
              <Scissors className="w-4 h-4 mr-3" />
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-wider">{t.hybridEdit}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{t.hybridEditDesc}</div>
              </div>
            </button>
            <button
              disabled={isProcessing}
              onClick={() => setForgeSettings({ forgeMode: 'MANUAL CUT' })}
              className={`flex items-center p-3 rounded border transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} ${forgeMode === 'MANUAL CUT' ? 'bg-red-900/20 border-red-500/50 text-red-500' : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
            >
              <ShieldAlert className="w-4 h-4 mr-3" />
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-wider">{t.manualCut}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{t.manualCutDesc}</div>
              </div>
            </button>
            <button
              disabled={isProcessing}
              onClick={() => setForgeSettings({ forgeMode: 'FULL EDIT' })}
              className={`flex items-center p-3 rounded border transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} ${forgeMode === 'FULL EDIT' ? 'bg-blue-900/20 border-blue-500/50 text-blue-500' : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
            >
              <Play className="w-4 h-4 mr-3" />
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-wider">{t.fullEdit}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{t.fullEditDesc}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Sliders (Only for Auto/Hybrid) */}
        {(forgeMode === 'AUTO FORGE' || forgeMode === 'HYBRID') && (
          <>
            <div className="space-y-3 pt-4 border-t border-zinc-900">
              <div className="flex justify-between items-center">
                <label className="flex items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {t.clipQuantity}
                </label>
                <span className="text-orange-500 font-mono text-sm font-bold">{forgeClipQuantity}</span>
              </div>
              <input 
                type="range" 
                min="1" max="15" step="1" 
                disabled={isProcessing}
                value={forgeClipQuantity}
                onChange={(e) => setForgeSettings({ forgeClipQuantity: parseInt(e.target.value) })}
                className={`w-full accent-orange-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              />
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-900">
              <div className="flex justify-between items-center">
                <label className="flex items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {t.targetDuration}
                </label>
                <span className="text-orange-500 font-mono text-sm font-bold">{forgeDurationMins} min</span>
              </div>
              <input 
                type="range" 
                min="1" max="30" step="1" 
                disabled={isProcessing}
                value={forgeDurationMins}
                onChange={(e) => setForgeSettings({ forgeDurationMins: parseInt(e.target.value) })}
                className={`w-full accent-orange-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer / Submit */}
      <div className="p-6 bg-black border-t border-zinc-900 z-10 sticky bottom-0">
        {isProcessing ? (
          <button
            onClick={cancelProcessing}
            className="w-full flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-red-900/40 text-red-500 border border-red-900/50 font-black py-4 px-4 rounded transition-all duration-300 transform active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.15)] uppercase tracking-[0.2em] text-xs"
          >
            <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full mr-2" />
            {t.cancel}
          </button>
        ) : (
          <button
            onClick={handleForge}
            disabled={(!videoFile && !projectId) || isProcessing}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black py-4 px-4 rounded transition-all duration-300 transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,88,12,0.3)] uppercase tracking-[0.2em] text-xs"
          >
            <Flame className="w-4 h-4" />
            <span>{t.ignite}</span>
          </button>
        )}
      </div>
    </div>
  );
}

import { useAppStore } from "../store/useAppStore";
import { RefreshCw, Play } from "lucide-react";

export function StyleEditor() {
  const { subtitleConfig, setSubtitleConfig, extractTranscript, renderCustomProject, processingStatus, projectId, transcript } = useAppStore();

  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      <div className="p-4 border-b border-zinc-900 shrink-0">
        <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500">Subtitle Style</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Presets */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Preset Style</label>
          <select 
            value={subtitleConfig.subtitle_style}
            onChange={(e) => setSubtitleConfig({ subtitle_style: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none focus:border-orange-500 transition-colors"
          >
            <option value="default">Default (Clean)</option>
            <option value="hormozi">Hormozi (Bold & Impact)</option>
            <option value="netflix">Netflix (Classic)</option>
          </select>
        </div>

        {/* Primary Color */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Primary Color</label>
          <div className="flex items-center space-x-3">
            <input 
              type="color" 
              value={subtitleConfig.primary_color}
              onChange={(e) => setSubtitleConfig({ primary_color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer bg-zinc-900 border-0 p-0"
            />
            <span className="text-sm font-mono text-zinc-300">{subtitleConfig.primary_color}</span>
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Font Size</label>
            <span className="text-xs font-mono text-zinc-500">{subtitleConfig.font_size}</span>
          </div>
          <input 
            type="range" 
            min="30" 
            max="150" 
            value={subtitleConfig.font_size}
            onChange={(e) => setSubtitleConfig({ font_size: parseInt(e.target.value) })}
            className="w-full accent-orange-500"
          />
        </div>

        {/* Animation */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Animation</label>
          <select 
            value={subtitleConfig.animation}
            onChange={(e) => setSubtitleConfig({ animation: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none focus:border-orange-500 transition-colors"
          >
            <option value="pop">Pop (Dynamic)</option>
            <option value="karaoke">Karaoke (Highlight)</option>
            <option value="none">None (Static)</option>
          </select>
        </div>

      </div>

      <div className="p-4 border-t border-zinc-900 shrink-0 space-y-3 bg-[#0a0a0a]">
        {!transcript ? (
          <button 
            disabled={processingStatus === 'transcribing'}
            onClick={() => extractTranscript(projectId)}
            className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded transition-colors flex justify-center items-center gap-2"
          >
            {processingStatus === 'transcribing' ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Gerando Transcrição...</>
            ) : '1. Gerar Transcrição'}
          </button>
        ) : (
          <button 
            disabled={processingStatus === 'processing'}
            onClick={() => renderCustomProject(projectId)}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-50 text-white text-xs font-bold py-3 rounded transition-colors flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(234,88,12,0.3)]"
          >
            {processingStatus === 'processing' ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Renderizando...</>
            ) : (
              <><Play className="w-4 h-4" /> 2. Aplicar & Renderizar</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

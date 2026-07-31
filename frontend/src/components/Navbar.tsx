"use client";

import React, { useState } from "react";
import { Zap, Key, Server, Sparkles, X, Check } from "lucide-react";

interface NavbarProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

export default function Navbar({ apiKey, setApiKey }: NavbarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  const handleSaveKey = () => {
    setApiKey(tempKey);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setShowSettings(false);
    }, 1200);
  };

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090a10]/80 border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-purple-500 to-cyan-400 p-[2px] shadow-lg shadow-violet-500/30">
              <div className="w-full h-full bg-[#090a10] rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400 fill-cyan-400/20 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-wider text-white">PLAY<span className="gradient-text">Squad</span></span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  API Edition
                </span>
              </div>
              <p className="text-xs text-gray-400">Stream & Video Auto Clipper</p>
            </div>
          </div>

          {/* VPS Status Badge & Settings Button */}
          <div className="flex items-center space-x-4">
            
            <div className="hidden sm:flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-xs text-gray-300">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>VPS Active</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/50 text-sm font-medium text-gray-200 transition-all shadow-sm cursor-pointer"
            >
              <Key className="w-4 h-4 text-cyan-400" />
              <span>{apiKey ? "API Key Configured" : "Configurar API Key"}</span>
              {apiKey && <span className="w-2 h-2 rounded-full bg-cyan-400"></span>}
            </button>

          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="playsquad-card max-w-md w-full p-6 relative border border-violet-500/30 shadow-2xl">
            
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Chave de API Cloud</h3>
                <p className="text-xs text-gray-400">Sem modelos locais. Processamento ultra rápido na VPS.</p>
              </div>
            </div>

            <div className="space-y-4 my-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                  OpenAI API Key (Whisper + GPT-4o)
                </label>
                <input
                  type="password"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-all"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Se deixado em branco, o sistema usará a chave configurada no backend .env.
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveKey}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Salvo com Sucesso!</span>
                </>
              ) : (
                <span>Salvar Configuração</span>
              )}
            </button>

          </div>
        </div>
      )}
    </>
  );
}

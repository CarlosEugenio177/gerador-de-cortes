"use client";

import { useState } from "react";
import { Send, Sparkles, Loader2, Video, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/useAppStore";

export function ChatArea() {
  const { messages, isThinking, addMessage, setThinking, videoFile, setProject, updateProgress } = useAppStore();
  const [input, setInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    if (!videoFile) {
      addMessage({ sender: "ai", text: "Please upload a raw video first before sending commands." });
      return;
    }

    // 1. Add user message
    addMessage({ sender: "user", text: input });
    
    const { forgeAspectRatios, forgeSubtitleStyle, forgeMode, forgeDurationMins, forgeClipQuantity } = useAppStore.getState();
    let promptText = input + `\n\nvideo_formats: ${forgeAspectRatios.join(",")}, subtitle_style: ${forgeSubtitleStyle}, mode: ${forgeMode}`;
    if (forgeMode === 'FULL EDIT') {
      promptText += `\n\nFULL_VIDEO_EDIT`;
    } else if (forgeMode !== 'MANUAL CUT') {
      promptText += `\n\nduration_request: ${forgeDurationMins} minutes\nclip_quantity: ${forgeClipQuantity}`;
    }

    setInput("");
    setThinking(true);
    
    // 2. Prepare Form Data
    const formData = new FormData();
    formData.append("file", videoFile);
    
    // Remove mock: Use actual file name
    const projectTitle = videoFile.name.replace(/\.[^/.]+$/, "");
    formData.append("title", projectTitle);
    
    formData.append("prompt", promptText);

    // 3. Real Fetch to Go Gateway
    try {
      updateProgress('UPLOADING', 'Uploading video and starting AI Engine...', 10);
      const res = await fetch("http://localhost:8000/api/v1/projects", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to create project");
      }

      const project = await res.json();
      
      // 4. Update Project ID (This triggers WebSocket!)
      setProject(project.id);
      
      // Update browser URL so F5 won't lose the project
      window.history.pushState(null, '', `/?project=${project.id}`);
      
      addMessage({
        sender: "ai",
        text: "Video uploaded successfully. Project created and dispatched to AI Worker. Check the status indicator..."
      });
    } catch (error) {
      console.error(error);
      addMessage({ sender: "ai", text: "System Error: Could not connect to Gateway API." });
      updateProgress('FAILED', 'System Error', 0);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Header */}
      <div className="h-12 flex items-center px-5 border-b border-zinc-900 z-10 bg-black">
        <h2 className="text-xs font-semibold text-zinc-400 tracking-widest uppercase">ClipForge AI</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col space-y-1"
            >
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-600">
                {msg.sender === "user" ? "You" : "ClipForge AI"}
              </span>
              <div
                className={`text-sm leading-relaxed ${
                  msg.sender === "user" ? "text-zinc-100" : "text-zinc-400 font-mono"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
          {isThinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col space-y-1"
            >
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-600">ClipForge AI</span>
              <div className="flex items-center space-x-2 text-zinc-500 text-sm font-mono">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black border-t border-zinc-900 z-10">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command..."
            className="w-full bg-[#0a0a0a] border border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-md pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="absolute right-2 p-1.5 text-zinc-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Activity, Server, Database, Clock, Zap, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  memory_total: number;
  memory_free: number;
  redis_ping: string;
  uptime: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API_URL}/api/v1/metrics/system`)
      .then(res => res.json())
      .then(data => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch metrics", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Polling cada 5s
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  const SimpleHeader = () => (
    <header className="h-14 border-b border-zinc-900 px-6 flex items-center justify-between shrink-0 z-10 relative bg-[#0a0a0a]">
      <div className="flex items-center space-x-4">
        <button 
          className="p-1 hover:bg-zinc-900 rounded transition-colors text-zinc-400 hover:text-white"
          onClick={() => window.location.href = '/'}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">ClipForge Studio</span>
          <span className="text-sm font-medium">Dashboard</span>
        </div>
      </div>
    </header>
  );

  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <SimpleHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col font-sans">
      <SimpleHeader />
      
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">System Dashboard</h1>
            <p className="text-sm text-zinc-400">Real-time observability and hardware monitoring</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-mono">LIVE UPDATE</span>
          </div>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* CPU */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">CPU Usage</h3>
                <Activity className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-3xl font-bold font-mono">
                {metrics.cpu_usage.toFixed(1)}%
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-1.5 mt-4">
                <div 
                  className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${metrics.cpu_usage}%` }}
                />
              </div>
            </motion.div>

            {/* Memory */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Memory</h3>
                <Server className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-bold font-mono">
                {metrics.memory_usage.toFixed(1)}%
              </div>
              <p className="text-xs text-zinc-500 mt-2 font-mono">
                {formatBytes(metrics.memory_total - metrics.memory_free)} / {formatBytes(metrics.memory_total)}
              </p>
              <div className="w-full bg-zinc-900 rounded-full h-1.5 mt-2">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${metrics.memory_usage}%` }}
                />
              </div>
            </motion.div>

            {/* Redis */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Redis Streams</h3>
                <Database className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex items-center space-x-3 mt-1">
                <div className={`w-3 h-3 rounded-full ${metrics.redis_ping === "PONG" ? "bg-red-500" : "bg-zinc-600"}`} />
                <span className="text-xl font-bold font-mono">{metrics.redis_ping === "PONG" ? "CONNECTED" : "OFFLINE"}</span>
              </div>
            </motion.div>

            {/* Uptime */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">API Uptime</h3>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold font-mono mt-1">
                {formatUptime(metrics.uptime)}
              </div>
            </motion.div>

          </div>
        )}
      </main>
    </div>
  );
}

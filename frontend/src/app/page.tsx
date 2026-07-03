"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Hammer, Play, Loader2, Scissors, Calendar, AlertTriangle, Trash2, Video } from "lucide-react";

interface Clip {
  id: number;
  title: string;
  video_url: string;
}

interface Project {
  id: number;
  title: string;
  status: string;
  original_file: string;
  created_at: string;
  clips?: Clip[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'clips'>('projects');
  const [clips, setClips] = useState<Clip[]>([]);

  const fetchProjects = () => {
    fetch("http://localhost:8000/api/v1/projects")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProjects(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load projects", err);
        setLoading(false);
      });
  };

  const fetchClips = () => {
    fetch("http://localhost:8000/api/v1/clips")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setClips(data);
        }
      })
      .catch(err => console.error("Failed to load clips", err));
  };

  useEffect(() => {
    if (!localStorage.getItem("clipforge_auth")) {
      router.push("/login");
      return;
    }
    fetchProjects();
    fetchClips();
  }, [router]);

  const handleDeleteProject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // prevent card click
    if (!confirm("Are you sure you want to delete this project? The clips will remain in the All Clips tab.")) return;

    try {
      await fetch(`http://localhost:8000/api/v1/projects/${id}`, { method: 'DELETE' });
      fetchProjects();
      fetchClips();
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleDeleteClip = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this clip?")) return;

    try {
      await fetch(`http://localhost:8000/api/v1/clips/${id}`, { method: 'DELETE' });
      fetchClips();
      fetchProjects(); // Update project clip counts if any
    } catch (err) {
      console.error("Failed to delete clip", err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 relative overflow-hidden">
      {/* Fire Background Effect */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-600/20 rounded-[100%] blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-700/10 rounded-[100%] blur-[150px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />

      {/* Header */}
      <header className="flex justify-between items-center mb-12 border-b border-zinc-900 pb-6 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.3)]">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase">CLIPFORGE</h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Factory Dashboard</p>
          </div>
        </div>
        
        <button 
          onClick={() => router.push("/forge")}
          className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-2 px-6 rounded transition-all duration-300 shadow-[0_0_15px_rgba(234,88,12,0.3)] flex items-center gap-2 uppercase tracking-wider text-xs"
        >
          <Hammer className="w-4 h-4" />
          New Forge
        </button>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto relative z-10 mb-8 flex space-x-8 border-b border-zinc-900">
        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${
            activeTab === 'projects' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="flex items-center gap-2"><Scissors className="w-4 h-4" /> Recent Forges</span>
        </button>
        <button
          onClick={() => setActiveTab('clips')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${
            activeTab === 'clips' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="flex items-center gap-2"><Video className="w-4 h-4" /> All Clips</span>
        </button>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto relative z-10">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : activeTab === 'projects' ? (
          projects.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center flex flex-col items-center justify-center bg-[#050505]/80 backdrop-blur">
              <Hammer className="w-12 h-12 text-zinc-700 mb-4" />
              <h3 className="text-lg font-bold text-zinc-400 uppercase tracking-widest">No Projects Yet</h3>
              <p className="text-zinc-600 text-sm mt-2 max-w-sm">Start your factory by forging a new video. The AI will do the heavy lifting.</p>
              <button 
                onClick={() => router.push("/forge")}
                className="mt-6 border border-zinc-700 hover:border-orange-500 text-zinc-400 hover:text-orange-500 font-bold py-2 px-6 rounded transition-all duration-300 uppercase tracking-wider text-xs"
              >
                Start First Forge
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((proj) => (
                <div 
                  key={proj.id} 
                  onClick={() => router.push(proj.status === 'completed' ? `/editor/${proj.id}` : `/forge?project=${proj.id}`)}
                  className="bg-[#0a0a0a]/90 backdrop-blur border border-zinc-800 hover:border-orange-500/50 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] group relative flex flex-col"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-zinc-200 truncate pr-4">{proj.title}</h3>
                    <button 
                      onClick={(e) => handleDeleteProject(e, proj.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    {proj.status === 'completed' ? (
                      <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">Ready</span>
                    ) : proj.status === 'cancelled' ? (
                      <span className="bg-zinc-500/10 text-zinc-400 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-zinc-500/20">Cancelled</span>
                    ) : proj.status === 'failed' ? (
                      <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-red-500/20 flex items-center gap-1 w-max"><AlertTriangle className="w-3 h-3"/> Failed</span>
                    ) : (
                      <span className="bg-orange-500/10 text-orange-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-orange-500/20 flex items-center gap-1 w-max">
                        <Loader2 className="w-3 h-3 animate-spin" /> Forging
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-zinc-500 text-xs mt-auto pt-4 space-x-4">
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(proj.created_at).toLocaleDateString()}
                    </div>
                    {proj.clips && proj.clips.length > 0 && (
                      <div className="flex items-center text-orange-500/80 font-bold">
                        <Video className="w-3 h-3 mr-1" />
                        {proj.clips.length} Clips
                      </div>
                    )}
                  </div>

                  {(proj.status === 'completed' || proj.status === 'cancelled') && (
                    <div className="mt-4 pt-4 border-t border-zinc-900 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Open Studio</span>
                      <Play className="w-4 h-4 text-orange-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          clips.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center flex flex-col items-center justify-center bg-[#050505]/80 backdrop-blur">
              <Video className="w-12 h-12 text-zinc-700 mb-4" />
              <h3 className="text-lg font-bold text-zinc-400 uppercase tracking-widest">No Clips Yet</h3>
              <p className="text-zinc-600 text-sm mt-2 max-w-sm">Clips you forge from your projects will appear here independently.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {Object.entries(
                clips.reduce((acc, clip) => {
                  const match = clip.title.match(/^\[(.*?)\]\s*(.*)/);
                  const format = match ? match[1] : "16:9";
                  const cleanTitle = match ? match[2] : clip.title;
                  
                  let platform = "Outras Redes (16:9)";
                  if (format === "9:16") platform = "TikTok / Reels / Shorts (9:16)";
                  else if (format === "1:1") platform = "Instagram Feed (1:1)";
                  else if (format === "16:9") platform = "YouTube (16:9)";
                  
                  // @ts-ignore
                  const projName = clip.project_name || "Clipes Independentes";
                  
                  if (!acc[projName]) acc[projName] = {};
                  if (!acc[projName][platform]) acc[projName][platform] = [];
                  
                  acc[projName][platform].push({ ...clip, title: cleanTitle });
                  return acc;
                }, {} as Record<string, Record<string, Clip[]>>)
              ).map(([projName, platforms]) => (
                <div key={projName} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
                  <h2 className="text-xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                    <div className="w-2 h-6 bg-orange-500 rounded-full" />
                    {projName}
                  </h2>
                  
                  <div className="space-y-8">
                    {Object.entries(platforms).map(([platform, platformClips]) => (
                      <div key={platform}>
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-zinc-900 pb-2">
                          <Video className="w-4 h-4 text-zinc-500" />
                          {platform}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {(platformClips as Clip[]).map((clip) => (
                            <div key={clip.id} className="bg-black border border-zinc-800 rounded-xl overflow-hidden group hover:border-orange-500/50 transition-colors">
                              <div className="relative aspect-video bg-zinc-900 flex items-center justify-center">
                                {clip.video_url ? (
                                  <video 
                                    src={`http://localhost:8000/${clip.video_url}`} 
                                    className="w-full h-full object-cover" 
                                    controls
                                    controlsList="nodownload"
                                    preload="metadata"
                                  />
                                ) : (
                                  <div className="text-zinc-600 flex flex-col items-center">
                                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                    <span className="text-xs">Processing...</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-3 flex justify-between items-start gap-3">
                                <h3 className="font-bold text-zinc-300 text-xs truncate leading-tight" title={clip.title}>{clip.title}</h3>
                                <button 
                                  onClick={(e) => handleDeleteClip(e, clip.id)}
                                  className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors -mt-1 -mr-1 shrink-0"
                                  title="Delete Clip"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}

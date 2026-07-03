"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "../../../lib/useWebSocket";
import { useAppStore } from "../../../store/useAppStore";
import { EditorLayout } from "../../../components/EditorLayout";
import { useRouter } from "next/navigation";

export default function EditorPage({ params }: { params: { id: string } }) {
  const { setProject, setClips, setSelectedClip, projectId } = useAppStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reconnect WS if missing
  useWebSocket(projectId);

  useEffect(() => {
    setMounted(true);
    
    if (!localStorage.getItem("clipforge_auth")) {
      router.push("/login");
      return;
    }

    const pid = params.id;
    if (pid && pid !== projectId) {
      setProject(pid);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      console.log("Fetching project from:", `${API_URL}/api/v1/projects/${pid}`);
      
      fetch(`${API_URL}/api/v1/projects/${pid}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then(project => {
          console.log("Fetched project:", project);
          if (project.original_file) {
             useAppStore.setState({ videoUrl: `${API_URL}/${project.original_file}` });
          }
          if (project.clips && project.clips.length > 0) {
            console.log("Setting clips:", project.clips);
            useAppStore.getState().setClips(project.clips);
            useAppStore.getState().setSelectedClip(project.clips[0]);
          } else if (project.Clips && project.Clips.length > 0) {
            console.log("Setting Clips (uppercase):", project.Clips);
            useAppStore.getState().setClips(project.Clips);
            useAppStore.getState().setSelectedClip(project.Clips[0]);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load project", err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [params.id, projectId, router, setClips, setProject, setSelectedClip]);

  if (!mounted || loading) return <div className="h-screen w-screen bg-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" /></div>;

  return <EditorLayout />;
}

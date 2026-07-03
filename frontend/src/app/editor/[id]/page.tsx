"use client";

import { useEffect, useState, useRef } from "react";
import { useWebSocket } from "../../../lib/useWebSocket";
import { useAppStore } from "../../../store/useAppStore";
import { EditorLayout } from "../../../components/EditorLayout";
import { useRouter, useParams } from "next/navigation";

export default function EditorPage() {
  const { setProject, setClips, setSelectedClip, projectId } = useAppStore();
  const router = useRouter();
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  // Reconnect WS if missing
  useWebSocket(projectId);

  useEffect(() => {
    setMounted(true);
    
    if (!localStorage.getItem("clipforge_auth")) {
      router.push("/login");
      return;
    }

    const pid = Array.isArray(params?.id) ? params.id[0] : params?.id;
    if (!pid) {
      setLoading(false);
      return;
    }

    setProject(pid as string);
    
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
        
        const projectClips = project.clips || project.Clips;
        if (projectClips && projectClips.length > 0) {
          console.log("Setting clips:", projectClips);
          useAppStore.getState().setClips(projectClips);
          useAppStore.getState().setSelectedClip(projectClips[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load project", err);
        setLoading(false);
      });
  }, [params.id, router, setProject]);

  if (!mounted || loading) return <div className="h-screen w-screen bg-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" /></div>;

  return <EditorLayout />;
}

"use client";

import { useEffect, useState, Suspense } from "react";
import { useWebSocket } from "../../lib/useWebSocket";
import { useAppStore } from "../../store/useAppStore";
import { ForgeControls } from "../../components/ForgeControls";
import { MediaViewer } from "../../components/MediaViewer";
import { useRouter, useSearchParams } from "next/navigation";

function ForgeContent() {
  const projectId = useAppStore((state) => state.projectId);
  const processingStatus = useAppStore((state) => state.processingStatus);
  const { setProject, updateProgress, setClips, setVideoFile, resetProject } = useAppStore();
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  
  useEffect(() => {
    if (!queryProjectId) {
      resetProject();
    }
  }, [resetProject, queryProjectId]);

  useWebSocket(projectId || queryProjectId);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem("clipforge_auth")) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    // Only fetch if we have an explicit queryProjectId
    // DO NOT fallback to projectId from store if queryProjectId is null, 
    // because that means the user wants a NEW forge, and the store's projectId is just leftover from the previous session.
    if (queryProjectId) {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      fetch(`${API_URL}/api/v1/projects/${queryProjectId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            setProject(data.id.toString());
            if (data.status === 'processing') {
              updateProgress(data.status, "Sincronizado com o servidor", 50);
            } else {
              updateProgress('IDLE', '', 0);
            }
            
            const videoPath = data.proxy_file || data.original_file;
            if (videoPath) {
              const filename = videoPath.split('/').pop() || videoPath.split('\\').pop();
              const fakeFile = new File([], filename);
              const cleanPath = videoPath.replace(/\\/g, '/');
              setVideoFile(fakeFile, `${API_URL}/${cleanPath}`);
            }

            if (data.clips && data.clips.length > 0) {
              setClips(data.clips);
            }
          }
        })
        .catch(err => console.error("Failed to rehydrate project", err));
    }
  }, [queryProjectId, setProject, updateProgress, setClips, setVideoFile]);

  useEffect(() => {
    if (processingStatus === 'COMPLETED' && projectId) {
      router.push(`/editor/${projectId}`);
    }
  }, [processingStatus, projectId, router]);

  if (!mounted) return <div className="h-screen w-screen bg-black" />;

  return (
    <div className="h-screen w-screen flex bg-black text-foreground overflow-hidden">
      <MediaViewer />
      
      <div className="w-[400px] shrink-0 border-l border-zinc-900 z-20 bg-[#050505] relative overflow-y-auto">
        <ForgeControls />
      </div>
    </div>
  );
}

export default function ForgePage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <ForgeContent />
    </Suspense>
  );
}

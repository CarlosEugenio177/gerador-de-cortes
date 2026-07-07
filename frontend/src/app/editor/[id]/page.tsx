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

    useAppStore.getState().hydrateProjectState(pid as string).then(() => {
      setLoading(false);
    }).catch(err => {
      console.error("Failed to hydrate project", err);
      setLoading(false);
    });
  }, [params.id, router, setProject]);

  if (!mounted || loading) return <div className="h-screen w-screen bg-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" /></div>;

  return <EditorLayout />;
}

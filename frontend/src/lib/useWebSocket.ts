import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

export const useWebSocket = (projectId: string | null) => {
  const wsRef = useRef<WebSocket | null>(null);
  const updateProgress = useAppStore((state) => state.updateProgress);

  useEffect(() => {
    if (!projectId) return;

    // Conectar ao Gateway Go (rota real)
    const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
    const wsHost = wsBase.replace(/\/ws$/, '');
    const wsUrl = `${wsHost}/api/v1/ws/projects/${projectId}`;
    console.log(`[WebSocket] Connecting to ${wsUrl}`);
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log(`[WebSocket] Connected for project ${projectId}`);
    };

    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WebSocket] Message received:', data);

        if (data.status) {
          updateProgress(data.status, data.message || '', data.progress || 0);

          if (data.status === 'COMPLETED') {
            // Fetch project to get clips
            try {
              const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
              const res = await fetch(`${API_URL}/api/v1/projects/${projectId}`);
              if (res.ok) {
                const project = await res.json();
                if (project.clips && project.clips.length > 0) {
                  const setClips = useAppStore.getState().setClips;
                  const setSelectedClip = useAppStore.getState().setSelectedClip;
                  setClips(project.clips);
                  setSelectedClip(project.clips[0]); // Select the first clip automatically
                }
              }
            } catch (fetchErr) {
              console.error('[WebSocket] Failed to fetch completed project clips', fetchErr);
            }
          }
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message', err);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    wsRef.current.onclose = () => {
      console.log(`[WebSocket] Disconnected for project ${projectId}`);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [projectId, updateProgress]);

  return wsRef.current;
};

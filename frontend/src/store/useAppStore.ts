import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface ClipResult {
  id: number;
  title: string;
  description: string;
  score: number;
  video_url: string;
}

interface AppState {
  projectId: string | null;
  videoUrl: string | null;
  videoFile: File | null;
  selectedClip: ClipResult | null;
  projectName: string;
  
  messages: ChatMessage[];
  isThinking: boolean;
  
  processingStatus: 'IDLE' | 'UPLOADING' | 'PREPROCESSING' | 'TRANSCRIBING' | 'ANALYZING' | 'RENDERING' | 'EXPORTING' | 'COMPLETED' | 'FAILED';
  statusMessage: string;
  progress: number;
  showOssPopup: boolean;
  
  clips: ClipResult[];
  
  


  forgeAspectRatios: string[];
  forgeSubtitleStyle: string;
  forgeMode: string;
  forgeClipQuantity: number;
  forgeDurationMins: number;
  forgeLanguage: 'en' | 'pt';

  


  setProjectName: (name: string) => void;
  setProject: (id: string) => void;
  resetProject: () => void;
  setVideoFile: (file: File, url: string) => void;
  setSelectedClip: (clip: ClipResult) => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setThinking: (thinking: boolean) => void;
  updateProgress: (status: AppState['processingStatus'], message: string, progress: number) => void;
  setShowOssPopup: (show: boolean) => void;
  setClips: (clips: ClipResult[]) => void;
  

  setForgeSettings: (settings: Partial<Pick<AppState, 'forgeAspectRatios' | 'forgeSubtitleStyle' | 'forgeMode' | 'forgeClipQuantity' | 'forgeDurationMins' | 'forgeLanguage'>>) => void;
  
  

  
  reprocessProject: (projectId: string, overridePrompt?: string) => Promise<void>;
  

  cancelProcessing: () => Promise<void>;
  hydrateProjectState: (projectId: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      projectId: null,
      videoUrl: null,
      videoFile: null,
      selectedClip: null,
      projectName: '',
      
      messages: [
        {
          id: 'welcome',
          sender: 'ai',
          text: 'Olá! Sou o ClipForge AI. Faça o upload do seu vídeo bruto e me diga o que quer criar (Ex: "Limpe as pausas de respiração e gere 3 cortes curtos").',
          timestamp: new Date()
        }
      ],
      isThinking: false,
      
      processingStatus: 'IDLE',
      statusMessage: '',
      progress: 0,
      showOssPopup: false,
      
      clips: [],
      
  


      forgeAspectRatios: ['9:16'],
      forgeSubtitleStyle: 'Fire',
      forgeMode: 'AUTO FORGE',
      forgeClipQuantity: 3,
      forgeDurationMins: 1,
      forgeLanguage: 'en',

      setProjectName: (name) => set({ projectName: name }),
      setProject: (id) => set({ projectId: id }),
      resetProject: () => set({
        projectId: null,
        videoUrl: null,
        videoFile: null,
        selectedClip: null,
        projectName: '',
        processingStatus: 'IDLE',
        statusMessage: '',
        progress: 0,
        showOssPopup: false,
        clips: [],
        messages: [
          {
            id: 'welcome',
            sender: 'ai',
            text: 'Olá! Sou o ClipForge AI. Faça o upload do seu vídeo bruto e me diga o que quer criar (Ex: "Limpe as pausas de respiração e gere 3 cortes curtos").',
            timestamp: new Date()
          }
        ]
      }),
      setVideoFile: (file, url) => set({ videoFile: file, videoUrl: url, projectName: file.name.replace(/\.[^/.]+$/, "") }),
      setSelectedClip: (clip) => set({ selectedClip: clip }),
      
      addMessage: (msg) => set((state) => ({ 
        messages: [...state.messages, { ...msg, id: Math.random().toString(36).substring(7), timestamp: new Date() }] 
      })),
      
      setThinking: (thinking) => set({ isThinking: thinking }),
      
      updateProgress: (status, message, progress) => set((state) => ({ 
        processingStatus: status, 
        statusMessage: message, 
        progress,
        showOssPopup: status === 'COMPLETED' && state.processingStatus !== 'COMPLETED' ? true : state.showOssPopup
      })),
      
      setShowOssPopup: (show) => set({ showOssPopup: show }),

      setClips: (clips) => set({ clips }),
      
  


      setForgeSettings: (settings) => set((state) => ({ ...state, ...settings })),

  


      reprocessProject: async (projectId: string, overridePrompt?: string) => {
        set({ processingStatus: 'ANALYZING', statusMessage: 'Starting AI reprocessing...', progress: 0 });
        try {
          const state = get();
          
          let promptInstruction = overridePrompt;
          
          if (!promptInstruction) {
            promptInstruction = `video_formats: ${state.forgeAspectRatios.join(",")}, subtitle_style: ${state.forgeSubtitleStyle}`;
            promptInstruction += `\n\nduration_request: ${state.forgeDurationMins} minutes\nclip_quantity: ${state.forgeClipQuantity}`;
          }

          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/reprocess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptInstruction }),
          });
          if (!res.ok) {
            throw new Error("Failed to reprocess project");
          }
        } catch (error) {
          console.error(error);
          set({ processingStatus: 'FAILED', statusMessage: 'Failed to start reprocessing' });
        }
      },
      cancelProcessing: async () => {
        const state = get();
        if (state.projectId) {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            await fetch(`${API_URL}/api/v1/projects/${state.projectId}/cancel`, { method: 'POST' });
          } catch (e) {
            console.error("Cancel failed", e);
          }
        }
        set({ processingStatus: 'IDLE', statusMessage: 'Cancelled', progress: 0 });
      },
      hydrateProjectState: async (projectId: string) => {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/state`);
          if (!res.ok) throw new Error("Failed to fetch project state");
          
          const data = await res.json();
          if (data && data.project) {
            const project = data.project;
            const videoPath = project.proxy_file || project.original_file;
            set({
              projectId: String(project.id),
              projectName: project.title || '',
              processingStatus: project.status as any,
              statusMessage: 'Project loaded from server',
              clips: project.clips || [],
              ...(videoPath ? { videoUrl: `${API_URL}/${videoPath.replace(/\\/g, '/')}` } : {})
            });

  
          }
        } catch (err) {
          console.error("Failed to hydrate project state", err);
        }
      },
    }),
    {
      name: 'clipforge-settings',
      partialize: (state) => ({
        forgeAspectRatios: state.forgeAspectRatios,
        forgeSubtitleStyle: state.forgeSubtitleStyle,
        forgeMode: state.forgeMode,
        forgeClipQuantity: state.forgeClipQuantity,
        forgeDurationMins: state.forgeDurationMins,
        forgeLanguage: state.forgeLanguage,
      }),
    }
  )
);

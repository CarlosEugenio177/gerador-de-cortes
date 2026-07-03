import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface EditOperation {
  type: string;
  start?: number;
  end?: number;
  score?: number;
  title?: string;
  description?: string;
  file?: string;
  style?: string;
}

export interface ClipResult {
  id: number;
  title: string;
  description: string;
  score: number;
  video_url: string;
}

export interface TranscriptWord {
  start: number;
  end: number;
  word: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
}

export interface SubtitleConfig {
  subtitle_style: string;
  primary_color: string;
  font_size: number;
  animation: string;
  video_format: string;
  remove_noise: boolean;
}

interface AppState {
  projectId: string | null;
  videoUrl: string | null;
  videoFile: File | null;
  selectedClip: ClipResult | null;
  projectName: string;
  
  messages: ChatMessage[];
  isThinking: boolean;
  
  processingStatus: 'idle' | 'processing' | 'rendering' | 'transcribing' | 'completed' | 'failed';
  statusMessage: string;
  progress: number;
  showOssPopup: boolean;
  
  clips: ClipResult[];
  
  advancedMode: boolean;
  editPlan: EditOperation[] | null;

  forgeAspectRatios: string[];
  forgeSubtitleStyle: string;
  forgeMode: string;
  forgeClipQuantity: number;
  forgeDurationMins: number;
  forgeLanguage: 'en' | 'pt';

  transcript: TranscriptSegment[] | null;
  subtitleConfig: SubtitleConfig;

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
  toggleAdvancedMode: () => void;
  setEditPlan: (plan: EditOperation[]) => void;
  setForgeSettings: (settings: Partial<Pick<AppState, 'forgeAspectRatios' | 'forgeSubtitleStyle' | 'forgeMode' | 'forgeClipQuantity' | 'forgeDurationMins' | 'forgeLanguage'>>) => void;
  
  setTranscript: (transcript: TranscriptSegment[]) => void;
  updateTranscriptWord: (segmentIndex: number, wordIndex: number, newWord: string) => void;
  setSubtitleConfig: (config: Partial<SubtitleConfig>) => void;
  
  reprocessProject: (projectId: string, overridePrompt?: string) => Promise<void>;
  extractTranscript: (projectId: string) => Promise<void>;
  renderCustomProject: (projectId: string) => Promise<void>;
  cancelProcessing: () => Promise<void>;
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
      
      processingStatus: 'idle',
      statusMessage: '',
      progress: 0,
      showOssPopup: false,
      
      clips: [],
      
      advancedMode: false,
      editPlan: null,

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
        processingStatus: 'idle',
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
        showOssPopup: status === 'completed' && state.processingStatus !== 'completed' ? true : state.showOssPopup
      })),
      
      setShowOssPopup: (show) => set({ showOssPopup: show }),

      setClips: (clips) => set({ clips }),
      
      toggleAdvancedMode: () => set((state) => ({ advancedMode: !state.advancedMode })),
      
      setEditPlan: (plan) => set({ editPlan: plan }),

      setForgeSettings: (settings) => set((state) => ({ ...state, ...settings })),

      transcript: null,
      subtitleConfig: {
        subtitle_style: 'default',
        primary_color: '#00FFFF',
        font_size: 90,
        animation: 'pop',
        video_format: '16:9',
        remove_noise: false,
      },
      
      setTranscript: (transcript) => set({ transcript }),
      
      updateTranscriptWord: (segmentIndex, wordIndex, newWord) => set((state) => {
        if (!state.transcript) return state;
        const newTranscript = [...state.transcript];
        const segment = { ...newTranscript[segmentIndex] };
        if (segment.words) {
          const words = [...segment.words];
          words[wordIndex] = { ...words[wordIndex], word: newWord };
          segment.words = words;
        }
        newTranscript[segmentIndex] = segment;
        return { transcript: newTranscript };
      }),
      
      setSubtitleConfig: (config) => set((state) => ({ 
        subtitleConfig: { ...state.subtitleConfig, ...config } 
      })),

      extractTranscript: async (projectId: string) => {
        set({ processingStatus: 'transcribing', statusMessage: 'Extracting transcript...', progress: 0 });
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/transcribe`, {
            method: 'POST',
          });
          if (!res.ok) throw new Error("Failed to start transcription");
        } catch (error) {
          console.error(error);
          set({ processingStatus: 'failed', statusMessage: 'Failed to extract transcript' });
        }
      },

      renderCustomProject: async (projectId: string) => {
        const state = get();
        set({ processingStatus: 'processing', statusMessage: 'Preparing custom render...', progress: 0 });
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          
          // 1. Save transcript first
          if (state.transcript) {
            await fetch(`${API_URL}/api/v1/projects/${projectId}/transcript`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(state.transcript),
            });
          }
          
          // 2. Dispatch custom render
          const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/render-custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.subtitleConfig),
          });
          if (!res.ok) throw new Error("Failed to start custom render");
        } catch (error) {
          console.error(error);
          set({ processingStatus: 'failed', statusMessage: 'Failed to start custom render' });
        }
      },

      reprocessProject: async (projectId: string, overridePrompt?: string) => {
        set({ processingStatus: 'processing', statusMessage: 'Starting AI reprocessing...', progress: 0 });
        try {
          const state = get();
          
          let promptInstruction = overridePrompt;
          
          if (!promptInstruction) {
            promptInstruction = `video_formats: ${state.forgeAspectRatios.join(",")}, subtitle_style: ${state.forgeSubtitleStyle}, mode: ${state.forgeMode}`;
            if (state.forgeMode === 'FULL EDIT') {
              promptInstruction += `\n\nFULL_VIDEO_EDIT`;
            } else if (state.forgeMode !== 'MANUAL CUT') {
              promptInstruction += `\n\nduration_request: ${state.forgeDurationMins} minutes\nclip_quantity: ${state.forgeClipQuantity}`;
            }
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
          set({ processingStatus: 'failed', statusMessage: 'Failed to start reprocessing' });
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
        set({ processingStatus: 'idle', statusMessage: 'Cancelled', progress: 0 });
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

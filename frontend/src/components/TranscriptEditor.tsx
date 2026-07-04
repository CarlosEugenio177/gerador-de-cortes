import { useAppStore } from "../store/useAppStore";
import { formatTime } from "../lib/utils";

export function TranscriptEditor() {
  const { transcript, updateTranscriptWord, processingStatus } = useAppStore();

  if (!transcript) {
    return (
      <div className="flex flex-col h-full bg-[#050505] items-center justify-center p-6 text-center border-l border-zinc-900">
        <div className="text-zinc-500 mb-2">Sem Transcrição</div>
        <p className="text-xs text-zinc-600">
          Gere a transcrição no menu de estilo primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] border-l border-zinc-900">
      <div className="p-4 border-b border-zinc-900 shrink-0">
        <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500">
          Modo Edição
        </h2>
        <p className="text-[10px] text-zinc-600 mt-1">
          Altere as palavras clicando nelas.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {transcript.map((segment, segmentIndex) => (
          <div key={segmentIndex} className="space-y-1">
            <div className="text-[10px] font-mono text-zinc-600">
              {formatTime(segment.start)} - {formatTime(segment.end)}
            </div>
            <div className="flex flex-wrap gap-1">
              {segment.words ? (
                segment.words.map((w, wordIndex) => (
                  <input
                    key={wordIndex}
                    type="text"
                    value={w.word}
                    onChange={(e) => updateTranscriptWord(segmentIndex, wordIndex, e.target.value)}
                    disabled={processingStatus === 'ANALYZING'}
                    className="bg-zinc-900 hover:bg-zinc-800 focus:bg-zinc-800 border border-transparent focus:border-orange-500 text-zinc-300 text-sm px-1 py-0.5 rounded outline-none transition-colors w-auto min-w-[30px]"
                    style={{ width: `${Math.max(w.word.length, 1)}ch` }}
                  />
                ))
              ) : (
                <div className="text-sm text-zinc-400">{segment.text}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

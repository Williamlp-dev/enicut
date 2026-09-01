import { useVideoContext } from "@/app/video-provider";
import { CutButton } from "@/components/controls/cut-button";
import { formatTime } from "@/lib/time";

interface TimeMetricCardProps {
  label: string;
  timeInSeconds: number;
}

// Exibe um rótulo e o timestamp formatado correspondente na barra inferior
function TimeMetricCard({ label, timeInSeconds }: TimeMetricCardProps) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-text-muted font-bold tracking-[0.05em] mb-0.5">
        {label}
      </span>
      <span className="font-mono text-xs text-text">
        {formatTime(timeInSeconds)}
      </span>
    </div>
  );
}

// Barra inferior com métricas de tempo selecionado e botão para exportar corte
export function FooterControls() {
  const { videoInfo, inPoint, outPoint } = useVideoContext();

  const cutDuration = Math.max(0, outPoint - inPoint);

  return (
    <footer className="flex items-center justify-between h-14 px-6 bg-surface border-t border-border">
      <div className="flex gap-8">
        <TimeMetricCard label="INÍCIO" timeInSeconds={inPoint} />
        <TimeMetricCard label="FIM" timeInSeconds={outPoint} />
        <TimeMetricCard label="DURAÇÃO" timeInSeconds={cutDuration} />
      </div>

      <div className="flex items-center gap-4">
        {videoInfo && <CutButton />}
      </div>
    </footer>
  );
}

import { FooterControls } from "@/components/controls/footer-controls";
import { PlaybackControls } from "@/components/controls/playback-controls";
import { VideoPlayer } from "@/components/player/video-player";
import { Timeline } from "@/components/timeline/timeline";
import { Titlebar } from "@/components/titlebar/titlebar";
import { useVideoContext, VideoProvider } from "./video-provider";

function AppContent() {
  const { videoInfo } = useVideoContext();

  return (
    <main className="h-screen flex flex-col bg-bg text-text select-none">
      <Titlebar />
      <div className="flex-1 relative flex flex-col min-h-0 bg-surface">
        <VideoPlayer />
      </div>
      {videoInfo && (
        <>
          <PlaybackControls />
          <div className="h-[120px] shrink-0 border-t border-border bg-surface relative flex flex-col">
            <Timeline />
          </div>
          <FooterControls />
        </>
      )}
    </main>
  );
}

export function App() {
  return (
    <VideoProvider>
      <AppContent />
    </VideoProvider>
  );
}

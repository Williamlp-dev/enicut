export interface VideoInfo {
  path: string;
  name: string;

  duration: number; // segundos

  width: number;
  height: number;

  fps: number;

  videoCodec: string;
  audioCodec?: string;

  bitrate?: number; // bits por segundo

  fileSize: number; // bytes
}

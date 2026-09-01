// Converte uma proporção de progresso (0–1) em tempo em segundos
export function progressToTime(progress: number, duration: number): number {
  return progress * duration;
}

// Converte tempo em segundos em proporção de progresso (0–1)
export function timeToProgress(time: number, duration: number): number {
  if (duration === 0) return 0;
  return time / duration;
}

// Converte um deslocamento em pixels na timeline em tempo de vídeo
export function pixelToTime(
  px: number,
  timelineWidth: number,
  duration: number,
): number {
  if (timelineWidth === 0) return 0;
  return (px / timelineWidth) * duration;
}

// Converte tempo de vídeo em deslocamento de pixels na timeline
export function timeToPixel(
  time: number,
  timelineWidth: number,
  duration: number,
): number {
  if (duration === 0) return 0;
  return (time / duration) * timelineWidth;
}

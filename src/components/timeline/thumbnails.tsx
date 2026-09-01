interface ThumbnailsProps {
  srcs: string[];
}

export function Thumbnails({ srcs }: ThumbnailsProps) {
  if (srcs.length === 0) return null;

  return (
    <div className="absolute inset-0 flex overflow-hidden rounded-md pointer-events-none opacity-90 z-0">
      {srcs.map((src, i) => (
        <img
          key={src}
          src={src}
          className="flex-1 h-full object-cover min-w-0 border-r border-background/20 last:border-r-0"
          alt={`Frame ${i + 1}`}
          draggable={false}
        />
      ))}
    </div>
  );
}

interface ThumbnailsProps {
  srcs: string[];
}

export function Thumbnails({ srcs }: ThumbnailsProps) {
  if (srcs.length === 0) return null;

  return (
    <div className="absolute inset-0 flex overflow-hidden rounded-md pointer-events-none opacity-90 z-0">
      {srcs.map((src, i) => (
        // O div é o flex item — tem sizing bem definido pelo flexbox.
        // O img fica absolute dentro dele para herdar as dimensões exatas
        // e o object-cover funcionar sem esticar.
        <div
          key={src || i}
          className="flex-1 basis-0 relative h-full border-r border-background/20 last:border-r-0"
        >
          {src ? (
            <img
              src={src}
              className="absolute inset-0 w-full h-full object-cover object-center"
              alt={`Frame ${i + 1}`}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 bg-surface-1" />
          )}
        </div>
      ))}
    </div>
  );
}

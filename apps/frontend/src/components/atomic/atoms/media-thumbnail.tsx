import { cn } from "@/lib/utils";

interface MediaThumbnailProps {
  alt?: string;
  className?: string;
  fallbackLabel: string;
  src?: string;
}

export const MediaThumbnail = ({ alt, className, fallbackLabel, src }: MediaThumbnailProps) => (
  <div className={cn("bg-muted text-muted-foreground overflow-hidden", className)}>
    {src ? (
      <img alt={alt ?? ""} className="h-full w-full object-cover" loading="lazy" src={src} />
    ) : (
      <div
        aria-label={fallbackLabel}
        className="grid h-full place-items-center text-4xl"
        role="img"
      >
        ♪
      </div>
    )}
  </div>
);

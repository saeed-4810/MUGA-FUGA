export const CoverPreview = ({ alt, preview }: { alt: string; preview: string | null }) => (
  <div className="bg-muted shadow-soft grid aspect-square place-items-center overflow-hidden rounded-xl">
    {preview ? <img alt={alt} className="h-full w-full object-cover" src={preview} /> : null}
  </div>
);

export const SummaryItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{label}</p>
    <p className="text-foreground mt-1 font-medium">{value}</p>
  </div>
);

export const SummaryChecklistItem = ({
  complete,
  label,
  value,
}: {
  complete: boolean;
  label: string;
  value: string;
}) => (
  <div className="mt-5 min-w-0">
    <p
      className={
        complete
          ? "text-primary text-xs font-semibold uppercase tracking-wide"
          : "text-muted-foreground text-xs font-semibold uppercase tracking-wide"
      }
    >
      {label}
    </p>
    <p className="text-foreground mt-1 truncate font-medium">{value}</p>
  </div>
);

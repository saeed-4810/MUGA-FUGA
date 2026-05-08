type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <h1 className={compact ? "" : "px-2"}>
      <img
        alt="FUGA"
        className={`${compact ? "h-5" : "h-8"} w-auto brightness-0 dark:brightness-100`}
        src="/fuga-logo.svg"
      />
    </h1>
  );
}

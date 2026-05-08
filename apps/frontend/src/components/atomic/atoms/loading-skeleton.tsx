import { cn } from "@/lib/utils";

type SkeletonShape = "card" | "row" | "text";

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  grid?: boolean;
  label: string;
  shape?: SkeletonShape;
}

const skeletonShapeClasses: Record<SkeletonShape, string> = {
  card: "border-border bg-card h-56 rounded-2xl border shadow-sm",
  row: "border-border bg-card h-12 rounded-xl border",
  text: "bg-muted h-4 w-full rounded",
};

export const LoadingSkeleton = ({
  className,
  count = 1,
  grid = false,
  label,
  shape = "card",
}: LoadingSkeletonProps) => {
  const items = Array.from({ length: count }, (_, index) => (
    <div
      aria-busy="true"
      className={cn("animate-pulse", skeletonShapeClasses[shape])}
      key={index}
    />
  ));

  return (
    <div
      aria-label={label}
      className={cn(grid ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3", className)}
      role="status"
    >
      {items}
    </div>
  );
};

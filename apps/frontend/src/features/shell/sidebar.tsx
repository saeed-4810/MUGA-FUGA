import { BrandMark } from "./brand-mark";
import { ShellNavigation } from "./shell-navigation";

type SidebarProps = {
  pendingReviewCount: number;
};

export function Sidebar({ pendingReviewCount }: SidebarProps) {
  return (
    <aside className="border-border hidden w-64 shrink-0 border-r bg-transparent px-4 py-5 lg:block">
      <div className="mb-8">
        <BrandMark />
      </div>
      <ShellNavigation pendingReviewCount={pendingReviewCount} />
    </aside>
  );
}

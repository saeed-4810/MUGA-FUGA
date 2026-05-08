export type ShellNavItem = {
  href: string;
  key: "adminQueue" | "artists" | "createProduct" | "dashboard" | "products";
  admin?: boolean;
  badge?: boolean;
  nested?: boolean;
};

export const shellNavItems: ShellNavItem[] = [
  { href: "/", key: "dashboard" },
  { href: "/products", key: "products" },
  { href: "/products/new", key: "createProduct", nested: true },
  { href: "/admin/artists", key: "artists", admin: true },
  { href: "/admin/queue", key: "adminQueue", admin: true, badge: true },
];

const NAV_ITEM_BASE =
  "flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors";
const NAV_ITEM_ACTIVE = "bg-accent text-accent-foreground shadow-glow";
const NAV_ITEM_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";

export function getNavItemClass(active: boolean, nested = false) {
  return `${NAV_ITEM_BASE} ${nested ? "ml-5 min-h-10 pl-4" : ""} ${active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`;
}

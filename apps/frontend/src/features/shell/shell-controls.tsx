import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

export function ShellControls() {
  return (
    <div className="flex items-center gap-2">
      <LocaleSwitcher />
      <ThemeToggle />
      <UserMenu />
    </div>
  );
}

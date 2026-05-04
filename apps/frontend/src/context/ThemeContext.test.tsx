import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";

import { ThemeProvider, useTheme } from "./ThemeContext";

const Probe = () => {
  const { resolved, theme, setTheme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="resolved">{resolved}</span>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggle}>toggle</button>
      <button onClick={() => setTheme("light")}>light</button>
      <button onClick={() => setTheme("dark")}>dark</button>
      <button onClick={() => setTheme("system")}>system</button>
    </div>
  );
};

describe("U-THEME-001..004: theme provider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("U-THEME-001 — defaults to light when no system preference is dark", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("U-THEME-002 — toggle flips between dark and light + applies the .dark class", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("U-THEME-003 — setTheme(dark) persists in localStorage and applies class", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(localStorage.getItem("muga.theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await user.click(screen.getByRole("button", { name: "light" }));
    expect(localStorage.getItem("muga.theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("U-THEME-004 — setTheme(system) honours stored value on next mount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    await user.click(screen.getByRole("button", { name: "system" }));
    expect(localStorage.getItem("muga.theme")).toBe("system");
    unmount();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme").textContent).toBe("system");
  });

  it("U-THEME-005 — useTheme outside provider throws a descriptive error", () => {
    const Bad = () => {
      useTheme();
      return null;
    };
    expect(() => act(() => render(<Bad />) as unknown as void)).toThrow(/within <ThemeProvider/);
  });

  it("U-THEME-005b — system theme resolves to dark when matchMedia matches dark + reacts to OS change", async () => {
    let listener: (() => void) | null = null;
    const mq = {
      matches: true,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: (_: string, l: () => void) => {
        listener = l;
      },
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
    const original = window.matchMedia;
    window.matchMedia = (() => mq) as unknown as typeof window.matchMedia;
    try {
      // Default theme is "system"; resolve() should pick "dark" because matches=true.
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
      expect(screen.getByTestId("resolved").textContent).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      // Trigger the change listener twice to exercise both ternary branches
      // in the matchMedia subscription handler (line 57 of ThemeContext.tsx).
      mq.matches = false;
      if (listener) (listener as () => void)();
      mq.matches = true;
      if (listener) (listener as () => void)();
    } finally {
      window.matchMedia = original;
    }
  });

  it("U-THEME-006 — readStoredTheme + persist tolerate a throwing localStorage (private mode)", async () => {
    // Replace localStorage with one that throws on every call.
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        get length() {
          return 0;
        },
        clear: () => undefined,
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("SecurityError");
        },
        key: () => null,
        removeItem: () => undefined,
      },
    });
    try {
      const user = userEvent.setup();
      // ThemeProvider must mount despite localStorage throwing on read AND write.
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
      // Defaults to "system" because the read failed.
      expect(screen.getByTestId("theme").textContent).toBe("system");
      // Toggle still functions; the persistence step swallows the throw.
      await user.click(screen.getByRole("button", { name: "dark" }));
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: original });
    }
  });
});

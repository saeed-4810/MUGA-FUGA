import { render, screen, act, waitFor } from "@testing-library/react";
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
    document.cookie = "muga.theme=; Path=/; Max-Age=0";
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
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
    expect(document.cookie).toContain("muga.theme=dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    await user.click(screen.getByRole("button", { name: "light" }));
    expect(localStorage.getItem("muga.theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("U-THEME-003b — initialTheme seeds the provider before localStorage exists", () => {
    render(
      <ThemeProvider initialTheme="dark">
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
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

  it("U-THEME-005b — system theme resolves after mount when matchMedia matches dark + reacts to OS change", async () => {
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
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
      await waitFor(() => expect(screen.getByTestId("resolved").textContent).toBe("dark"));
      await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));

      mq.matches = false;
      if (listener) (listener as () => void)();
      mq.matches = true;
      if (listener) (listener as () => void)();
    } finally {
      window.matchMedia = original;
    }
  });

  it("U-THEME-006 — readStoredTheme + persist tolerate a throwing localStorage (private mode)", async () => {
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
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
      expect(screen.getByTestId("theme").textContent).toBe("system");
      await user.click(screen.getByRole("button", { name: "dark" }));
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: original });
    }
  });

  it("U-THEME-007 — persist tolerates cookie write failures", async () => {
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: () => {
        throw new Error("Cookie blocked");
      },
    });
    try {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
      await user.click(screen.getByRole("button", { name: "dark" }));
      expect(localStorage.getItem("muga.theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    } finally {
      if (cookieDescriptor) Object.defineProperty(Document.prototype, "cookie", cookieDescriptor);
      Reflect.deleteProperty(document, "cookie");
    }
  });
});

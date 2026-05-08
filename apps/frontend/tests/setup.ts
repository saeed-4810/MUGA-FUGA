import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, beforeEach } from "vitest";

import { I18N_NAMESPACES, resources } from "../src/i18n/resources";

const buildLocalStoragePolyfill = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
  };
};

beforeAll(() => {
  // jsdom doesn't implement matchMedia by default
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  class ResizeObserverPolyfill {
    observe(): void {
      // jsdom has no layout engine; tests only need Radix components to mount.
    }

    unobserve(): void {
      // jsdom has no layout engine; tests only need Radix components to mount.
    }

    disconnect(): void {
      // jsdom has no layout engine; tests only need Radix components to mount.
    }
  }

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverPolyfill,
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverPolyfill,
  });

  // jsdom in vitest sometimes ships without a Storage implementation;
  // ensure both window.localStorage and window.sessionStorage are present.
  if (!("localStorage" in globalThis) || typeof globalThis.localStorage?.clear !== "function") {
    Object.defineProperty(globalThis, "localStorage", {
      value: buildLocalStoragePolyfill(),
      writable: true,
    });
  }
  if (!("sessionStorage" in globalThis) || typeof globalThis.sessionStorage?.clear !== "function") {
    Object.defineProperty(globalThis, "sessionStorage", {
      value: buildLocalStoragePolyfill(),
      writable: true,
    });
  }

  // Initialise i18next synchronously with the same bundled catalogs as the app.
  void i18next.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "nl"],
    ns: I18N_NAMESPACES,
    defaultNS: "common",
    resources,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
});

beforeEach(() => {
  globalThis.localStorage?.clear();
});

afterEach(() => {
  cleanup();
});

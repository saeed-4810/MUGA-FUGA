import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, beforeEach } from "vitest";

import enAdmin from "../locales/en/admin.json";
import enArtists from "../locales/en/artists.json";
import enAuth from "../locales/en/auth.json";
import enCommon from "../locales/en/common.json";
import enErrors from "../locales/en/errors.json";
import enProducts from "../locales/en/products.json";
import nlAdmin from "../locales/nl/admin.json";
import nlArtists from "../locales/nl/artists.json";
import nlAuth from "../locales/nl/auth.json";
import nlCommon from "../locales/nl/common.json";
import nlErrors from "../locales/nl/errors.json";
import nlProducts from "../locales/nl/products.json";

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

  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverPolyfill {
      observe(): void {
        // noop: Radix Slider only needs the API to exist in jsdom tests.
      }

      unobserve(): void {
        // noop
      }

      disconnect(): void {
        // noop
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      value: ResizeObserverPolyfill,
      writable: true,
    });
  }

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

  // Initialise i18next synchronously with the real catalogs so component
  // tests don't have to mock useTranslation. The production app uses
  // i18next-http-backend to lazy-load catalogs (which jsdom can't reach);
  // in tests we ship them inline.
  void i18next.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "nl"],
    ns: ["common", "auth", "products", "admin", "artists", "errors"],
    defaultNS: "common",
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        admin: enAdmin,
        artists: enArtists,
        products: enProducts,
        errors: enErrors,
      },
      nl: {
        common: nlCommon,
        auth: nlAuth,
        admin: nlAdmin,
        artists: nlArtists,
        products: nlProducts,
        errors: nlErrors,
      },
    },
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

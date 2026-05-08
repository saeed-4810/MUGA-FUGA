import enAdmin from "../../locales/en/admin.json";
import enArtists from "../../locales/en/artists.json";
import enAuth from "../../locales/en/auth.json";
import enCommon from "../../locales/en/common.json";
import enErrors from "../../locales/en/errors.json";
import enProducts from "../../locales/en/products.json";
import nlAdmin from "../../locales/nl/admin.json";
import nlArtists from "../../locales/nl/artists.json";
import nlAuth from "../../locales/nl/auth.json";
import nlCommon from "../../locales/nl/common.json";
import nlErrors from "../../locales/nl/errors.json";
import nlProducts from "../../locales/nl/products.json";

export const DEFAULT_LOCALE = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en";
export const SUPPORTED_LOCALES = (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES ?? "en,nl")
  .split(",")
  .map((locale) => locale.trim())
  .filter(Boolean);

export const I18N_NAMESPACES = [
  "common",
  "auth",
  "products",
  "admin",
  "artists",
  "errors",
] as const;

export const resources = {
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
} as const;

export type SupportedLocale = keyof typeof resources;

export const normalizeLocale = (value: string | null | undefined): SupportedLocale => {
  const normalized = value?.slice(0, 2).toLowerCase();
  return normalized === "nl" ? "nl" : "en";
};

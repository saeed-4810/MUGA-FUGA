import { describe, expect, it } from "vitest";

import { THEME_BOOTSTRAP_SCRIPT } from "./theme-bootstrap";

describe("U-THEME-BOOTSTRAP-001: root theme bootstrap", () => {
  it("keeps the hydration guard browser-only and preference-aware", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("try{");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("localStorage.getItem('muga.theme')");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("muga\\.theme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("classList.toggle('dark',d)");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("catch{}");
  });
});

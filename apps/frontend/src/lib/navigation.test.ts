import { describe, expect, it, vi } from "vitest";

import { navigateTo, replaceWith } from "./navigation";

describe("navigation helpers", () => {
  it("delegates push-style navigation to location.assign", () => {
    const assign = vi.fn();
    const replace = vi.fn();

    navigateTo("/products", { assign, replace });

    expect(assign).toHaveBeenCalledWith("/products");
    expect(replace).not.toHaveBeenCalled();
  });

  it("delegates replace-style navigation to location.replace", () => {
    const assign = vi.fn();
    const replace = vi.fn();

    replaceWith("/login", { assign, replace });

    expect(replace).toHaveBeenCalledWith("/login");
    expect(assign).not.toHaveBeenCalled();
  });
});

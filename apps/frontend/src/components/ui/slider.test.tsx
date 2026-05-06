import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slider } from "./slider";

describe("Slider", () => {
  it("U-UI-SLIDER-001 — renders the Radix slider primitive with supplied value", () => {
    const onValueChange = vi.fn();
    render(<Slider aria-label="Zoom" onValueChange={onValueChange} value={[1.5]} />);

    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "1.5");
  });
});

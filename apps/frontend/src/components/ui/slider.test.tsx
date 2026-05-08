import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Slider } from "./slider";

describe("Slider", () => {
  it("renders an accessible slider control", () => {
    render(<Slider aria-label="Volume" defaultValue={[50]} max={100} min={0} step={1} />);

    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "50");
  });
});

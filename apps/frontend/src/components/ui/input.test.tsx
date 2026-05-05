import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("renders a tokenized input with forwarded attributes", () => {
    render(<Input aria-label="Album name" maxLength={120} placeholder="Album" />);

    expect(screen.getByLabelText("Album name")).toHaveClass("border-input", "bg-background");
    expect(screen.getByLabelText("Album name")).toHaveAttribute("maxlength", "120");
  });
});

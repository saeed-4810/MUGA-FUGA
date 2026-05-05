import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";
import { Label } from "./label";

describe("Label", () => {
  it("associates label text with a form control", () => {
    render(
      <div>
        <Label htmlFor="artist">Artist</Label>
        <Input id="artist" />
      </div>
    );

    expect(screen.getByLabelText("Artist")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toHaveClass("text-foreground");
  });
});

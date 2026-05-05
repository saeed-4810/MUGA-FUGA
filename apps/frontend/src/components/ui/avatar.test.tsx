import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

describe("Avatar", () => {
  it("renders accessible image and fallback primitives", () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarImage src="/artist.jpg" alt="Artist portrait" />
        <AvatarFallback>AP</AvatarFallback>
      </Avatar>
    );

    expect(screen.getByTestId("avatar")).toHaveClass("rounded-full");
    expect(screen.getByText("AP")).toHaveClass("bg-muted", "text-muted-foreground");
  });
});

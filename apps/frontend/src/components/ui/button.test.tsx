import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("renders default button with semantic primary classes", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground"
    );
  });

  it("supports alternate variants and sizes", () => {
    render(
      <Button variant="destructive" size="sm">
        Delete
      </Button>
    );

    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-destructive", "h-9");
  });

  it("renders as child and exposes variant helper", () => {
    render(
      <Button asChild variant="link">
        <a href="/products">Products</a>
      </Button>
    );

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products");
    expect(buttonVariants({ variant: "outline", size: "icon" })).toContain("border-input");
  });
});

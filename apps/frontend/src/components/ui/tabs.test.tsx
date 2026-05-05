import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("Tabs primitives", () => {
  it("switches tab content with accessible triggers", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="details">
        <TabsList aria-label="Create product steps">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>
        <TabsContent value="details">Enter details</TabsContent>
        <TabsContent value="review">Review product</TabsContent>
      </Tabs>
    );

    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("data-state", "active");
    await user.click(screen.getByRole("tab", { name: "Review" }));
    expect(screen.getByRole("tab", { name: "Review" })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Review product")).toBeInTheDocument();
  });
});

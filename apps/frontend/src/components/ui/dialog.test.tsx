import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

describe("Dialog primitives", () => {
  it("opens accessible dialog content and closes via controls", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open moderation</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject product</DialogTitle>
            <DialogDescription>Provide a safe reason.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByRole("button", { name: "Open moderation" }));
    expect(screen.getByRole("dialog", { name: "Reject product" })).toBeInTheDocument();
    expect(screen.getByText("Provide a safe reason.")).toHaveClass("text-muted-foreground");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Reject product" })).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DialogComposition,
  EmptyState,
  ErrorState,
  FieldGroup,
  LoadingSkeleton,
  MediaThumbnail,
  PageSurface,
  StatusBanner,
  StatusPill,
  WizardSteps,
} from ".";

describe("U-ATOMIC-ATOM-001..008: atomic UI foundation", () => {
  it("renders accessible status and error banners with semantic roles", () => {
    render(
      <>
        <StatusBanner tone="success">Saved</StatusBanner>
        <ErrorState>Failed</ErrorState>
      </>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  });

  it("renders empty states with optional action", () => {
    render(
      <EmptyState
        action={<button type="button">Create</button>}
        description="No rows"
        title="Empty"
      />
    );

    expect(screen.getByRole("heading", { name: "Empty" })).toBeInTheDocument();
    expect(screen.getByText("No rows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("renders loading skeletons as labelled busy status regions", () => {
    const { container } = render(<LoadingSkeleton count={3} grid label="Loading products" />);

    expect(screen.getByRole("status", { name: "Loading products" })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(3);
  });

  it("renders wizard steps with the active step announced", () => {
    render(
      <WizardSteps
        label="Create product steps"
        steps={[
          { id: "details", label: "Details", description: "Name it", state: "complete" },
          { id: "cover", label: "Cover", description: "Upload art", state: "active" },
        ]}
      />
    );

    expect(screen.getByRole("list", { name: "Create product steps" })).toBeInTheDocument();
    expect(screen.getByText("Cover").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("renders media fallback, status pill, field group, dialog composition, and page surface", () => {
    render(
      <PageSurface variant="panel">
        <FieldGroup description="Human readable" title="Metadata">
          <MediaThumbnail className="h-24 w-24" fallbackLabel="No cover art" />
          <StatusPill tone="pending">Pending</StatusPill>
        </FieldGroup>
        <DialogComposition actions={<button type="button">Close</button>} title="Dialog title">
          Body
        </DialogComposition>
      </PageSurface>
    );

    expect(screen.getByRole("img", { name: "No cover art" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Metadata" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dialog title" })).toBeInTheDocument();
  });

  it("covers optional atomic branches for media, empty, field, wizard, and dialog molecules", () => {
    const { container } = render(
      <>
        <MediaThumbnail
          className="h-12 w-12"
          fallbackLabel="Cover loaded"
          src="https://cdn.example/cover.jpg"
        />
        <EmptyState title="No description" />
        <FieldGroup title="No description field">Input</FieldGroup>
        <DialogComposition description="Dialog details" title="No actions dialog">
          Body
        </DialogComposition>
        <WizardSteps
          label="Default pending steps"
          steps={[{ id: "pending", label: "Pending", description: "Waiting" }]}
        />
        <StatusBanner>Default status</StatusBanner>
      </>
    );

    expect(container.querySelector('img[src="https://cdn.example/cover.jpg"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: "No description" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No description field" })).toBeInTheDocument();
    expect(screen.getByText("Dialog details")).toBeInTheDocument();
    expect(screen.getByText("Pending").closest("li")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Default status")).toBeInTheDocument();
  });
});

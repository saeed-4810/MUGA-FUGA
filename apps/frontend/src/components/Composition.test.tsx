import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DialogComposition,
  FieldGroup,
  PageSurface,
  StatusBanner,
  TableComposition,
  WizardSteps,
} from "./Composition";

describe("shared composition patterns", () => {
  it("renders a panel page surface", () => {
    render(<PageSurface variant="panel">Dashboard body</PageSurface>);

    expect(screen.getByText("Dashboard body")).toHaveClass("max-w-6xl", "bg-card/80");
  });

  it("renders field groups with optional descriptions", () => {
    render(
      <FieldGroup description="Tell reviewers what this release is." title="Product details">
        <label htmlFor="name">Name</label>
      </FieldGroup>
    );

    expect(screen.getByRole("heading", { name: "Product details" })).toBeInTheDocument();
    expect(screen.getByText("Tell reviewers what this release is.")).toHaveClass(
      "text-muted-foreground"
    );
  });

  it("renders field groups without descriptions", () => {
    render(
      <FieldGroup title="Cover art">
        <span>Upload area</span>
      </FieldGroup>
    );

    expect(screen.getByRole("heading", { name: "Cover art" })).toBeInTheDocument();
    expect(screen.getByText("Upload area")).toBeInTheDocument();
  });

  it("renders status banners with alert role and danger tone", () => {
    render(
      <StatusBanner role="alert" tone="danger">
        Something failed
      </StatusBanner>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
    expect(screen.getByRole("alert")).toHaveClass("border-destructive/40");
  });

  it("renders accessible wizard steps with active and complete states", () => {
    render(
      <WizardSteps
        label="Create product progress"
        steps={[
          { id: "details", label: "Details", description: "Name the product.", state: "complete" },
          { id: "artist", label: "Artist", description: "Pick an artist.", state: "active" },
          { id: "cover", label: "Cover", description: "Upload artwork." },
        ]}
      />
    );

    expect(screen.getByRole("list", { name: "Create product progress" })).toBeInTheDocument();
    expect(screen.getByText("Artist").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Details").closest("li")).toHaveClass("border-primary/40");
    expect(screen.getByText("Cover").closest("li")).toHaveClass("border-border", "bg-card");
  });

  it("renders table composition with optional description", () => {
    render(
      <TableComposition description="Review pending products." title="Approval queue">
        <table>
          <tbody>
            <tr>
              <td>Album</td>
            </tr>
          </tbody>
        </table>
      </TableComposition>
    );

    expect(screen.getByRole("heading", { name: "Approval queue" })).toBeInTheDocument();
    expect(screen.getByText("Review pending products.")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("Album")).toBeInTheDocument();
  });

  it("renders table composition without description", () => {
    render(
      <TableComposition title="Artists">
        <p>Published artists</p>
      </TableComposition>
    );

    expect(screen.getByRole("heading", { name: "Artists" })).toBeInTheDocument();
    expect(screen.getByText("Published artists")).toBeInTheDocument();
  });

  it("renders dialog composition with optional actions", () => {
    render(
      <DialogComposition actions={<button type="button">Confirm</button>} title="Request artist">
        <p>Artist details</p>
      </DialogComposition>
    );

    expect(screen.getByRole("heading", { name: "Request artist" })).toBeInTheDocument();
    expect(screen.getByText("Artist details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("renders dialog composition description without actions", () => {
    render(
      <DialogComposition description="Admin reviews this request." title="Request artist">
        <p>Artist details</p>
      </DialogComposition>
    );

    expect(screen.getByText("Admin reviews this request.")).toHaveClass("text-muted-foreground");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

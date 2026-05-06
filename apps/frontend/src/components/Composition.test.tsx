import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DialogComposition,
  EmptyState,
  ErrorState,
  FieldGroup,
  LoadingSkeleton,
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

  it("LoadingSkeleton (default card) renders one aria-busy placeholder with status role and label", () => {
    render(<LoadingSkeleton label="Loading products" />);

    const status = screen.getByRole("status", { name: "Loading products" });
    expect(status).toBeInTheDocument();
    const busy = status.querySelectorAll('[aria-busy="true"]');
    expect(busy).toHaveLength(1);
    expect(busy[0]).toHaveClass("animate-pulse", "h-56", "rounded-2xl");
  });

  it("LoadingSkeleton with grid + count renders the expected number of card placeholders", () => {
    render(<LoadingSkeleton count={6} grid label="Loading products" />);

    const status = screen.getByRole("status", { name: "Loading products" });
    expect(status).toHaveClass("grid", "sm:grid-cols-2", "lg:grid-cols-3");
    expect(status.querySelectorAll('[aria-busy="true"]')).toHaveLength(6);
  });

  it("LoadingSkeleton honours row and text shapes", () => {
    const { rerender } = render(<LoadingSkeleton label="Loading row" shape="row" />);

    expect(screen.getByRole("status", { name: "Loading row" }).firstChild).toHaveClass("h-12");

    rerender(<LoadingSkeleton label="Loading text" shape="text" />);
    expect(screen.getByRole("status", { name: "Loading text" }).firstChild).toHaveClass(
      "h-4",
      "w-full"
    );
  });

  it("EmptyState renders title only", () => {
    render(<EmptyState title="No products yet" />);

    expect(screen.getByRole("heading", { name: "No products yet" })).toBeInTheDocument();
  });

  it("EmptyState renders description and an action when provided", () => {
    render(
      <EmptyState
        action={<a href="/products/new">Create product</a>}
        description="Once you publish your first release it will appear here."
        title="No products yet"
      />
    );

    expect(screen.getByRole("heading", { name: "No products yet" })).toBeInTheDocument();
    expect(
      screen.getByText(/once you publish your first release it will appear here\./i)
    ).toHaveClass("text-muted-foreground");
    expect(screen.getByRole("link", { name: "Create product" })).toHaveAttribute(
      "href",
      "/products/new"
    );
  });

  it("ErrorState renders children inside a role=alert with destructive tone", () => {
    render(<ErrorState>INTERNAL: boom</ErrorState>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/INTERNAL: boom/);
    expect(alert).toHaveClass("border-destructive/40");
  });

  it("Composition primitives expose responsive Tailwind utilities for 375/768/1024/1440px breakpoints", () => {
    // We assert presence of Tailwind sm:/md:/lg:/xl: utility classes on the
    // primitives that own responsive layout, which map to:
    //   sm = 640px (handles 768px tablet),
    //   md = 768px,
    //   lg = 1024px (desktop),
    //   xl = 1280px (covers 1440px wide).
    // Mobile-first defaults cover 375px without an explicit breakpoint.
    render(
      <PageSurface variant="panel">
        <FieldGroup title="Details">
          <span>field</span>
        </FieldGroup>
        <WizardSteps
          label="steps"
          steps={[
            { id: "a", label: "A", description: "a" },
            { id: "b", label: "B", description: "b" },
          ]}
        />
        <DialogComposition actions={<button type="button">ok</button>} title="t">
          <span>x</span>
        </DialogComposition>
        <LoadingSkeleton count={2} grid label="loading" />
      </PageSurface>
    );

    // PageSurface panel — fluid up to max-w-6xl, padding scales at sm
    expect(screen.getByText("field").closest("section")).toHaveClass("max-w-6xl");
    // FieldGroup — minimal typography/spacing, no nested card boundary
    expect(
      screen.getByRole("heading", { name: "Details" }).closest("div")?.parentElement
    ).toHaveClass("space-y-4");
    // WizardSteps — 1col mobile → 2col sm → 4col lg
    expect(screen.getByRole("list", { name: "steps" })).toHaveClass(
      "grid",
      "sm:grid-cols-2",
      "lg:grid-cols-4"
    );
    // DialogComposition footer — column on mobile, row at sm
    expect(screen.getByRole("button", { name: "ok" }).parentElement).toHaveClass(
      "flex-col-reverse",
      "sm:flex-row"
    );
    // LoadingSkeleton grid — 1col → 2col sm → 3col lg
    expect(screen.getByRole("status", { name: "loading" })).toHaveClass(
      "sm:grid-cols-2",
      "lg:grid-cols-3"
    );
  });
});

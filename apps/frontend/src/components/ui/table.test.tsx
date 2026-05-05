import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

describe("Table primitives", () => {
  it("renders semantic table sections and cells", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Album</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByRole("table")).toHaveClass("w-full");
    expect(screen.getByRole("columnheader", { name: "Product" })).toHaveClass(
      "text-muted-foreground"
    );
    expect(screen.getByRole("cell", { name: "Album" })).toBeInTheDocument();
  });
});

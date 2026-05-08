/**
 * U-ROLE-SWITCH-001..003 — centered bottom demo role switch toggle.
 *
 * Covers:
 *   - signed-out/loading users do not see the demo switch
 *   - customer role renders an off switch and can turn admin mode on
 *   - admin role renders an on switch and loading disables it
 *   - failures surface user-safe copy
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import { RoleSwitchToggle } from "./RoleSwitchToggle";

const customerUser = {
  uid: "usr_saeed_h",
  email: "saeedh582@gmail.com",
  role: "customer",
  displayName: "Saeed Hassanpour",
  photoURL: null,
};

const adminUser = {
  uid: "usr_marcus_admin",
  email: "marcus@muga.app",
  role: "admin",
  displayName: "Marcus Reed",
  photoURL: null,
};

describe("RoleSwitchToggle — centered bottom demo role control", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("U-ROLE-SWITCH-001a — hides while loading or signed out", () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
      switchingRole: false,
      switchRole: vi.fn(),
    });
    const { rerender } = render(<RoleSwitchToggle />);
    expect(screen.queryByRole("switch", { name: /admin mode/i })).toBeNull();

    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      switchingRole: false,
      switchRole: vi.fn(),
    });
    rerender(<RoleSwitchToggle />);
    expect(screen.queryByRole("switch", { name: /admin mode/i })).toBeNull();
  });

  it("U-ROLE-SWITCH-001 — customer sees a demo off switch and can turn admin mode on", async () => {
    const switchRole = vi.fn(async () => undefined);
    useAuthMock.mockReturnValue({
      user: customerUser,
      loading: false,
      switchingRole: false,
      switchRole,
    });
    const user = userEvent.setup();
    render(<RoleSwitchToggle />);

    expect(screen.getByText(/^demo$/i)).toBeInTheDocument();
    expect(screen.getByText(/experimental role switcher/i)).toHaveClass("sr-only");
    expect(screen.getByText(/^admin mode$/i)).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: /turn admin mode on/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    expect(switchRole).toHaveBeenCalledWith("admin");
    expect(screen.getByText(/role switched/i)).toBeInTheDocument();
  });

  it("U-ROLE-SWITCH-002 — admin sees an on switch and loading disables it", () => {
    useAuthMock.mockReturnValue({
      user: adminUser,
      loading: false,
      switchingRole: true,
      switchRole: vi.fn(),
    });
    render(<RoleSwitchToggle />);

    const toggle = screen.getByRole("switch", { name: /switching role/i });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/^on$/i)).toBeInTheDocument();
  });

  it("U-ROLE-SWITCH-003 — role switch failures surface user-safe error copy", async () => {
    useAuthMock.mockReturnValue({
      user: customerUser,
      loading: false,
      switchingRole: false,
      switchRole: vi.fn(async () => {
        throw new Error("gate disabled");
      }),
    });
    const user = userEvent.setup();
    render(<RoleSwitchToggle />);

    await user.click(screen.getByRole("switch", { name: /turn admin mode on/i }));

    expect(screen.getByText(/role switch failed/i)).toBeInTheDocument();
  });
});

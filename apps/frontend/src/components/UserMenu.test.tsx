/**
 * U-AUTH-002 — UserMenu component.
 *
 * Covers:
 *   - loading state shows skeleton with aria-busy
 *   - unauthenticated state shows "Sign in with Google" button → click triggers signIn
 *   - authenticated state shows display name (or email fallback) + role
 *   - photo URL renders as <img>; absent photo renders the email-initial fallback
 *   - sign-out click triggers signOut
 *   - admin role label differs from customer (i18n keyed)
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const replaceWithMock = vi.fn();
vi.mock("../lib/navigation", () => ({
  replaceWith: (path: string) => replaceWithMock(path),
}));

import { UserMenu } from "./UserMenu";

const authDefaults = {
  switchingRole: false,
  switchRole: vi.fn(),
};

describe("UserMenu — header dropdown for the signed-in/signed-out states", () => {
  beforeEach(() => {
    replaceWithMock.mockClear();
  });

  it("U-AUTH-002a — while AuthContext is loading, render an aria-busy skeleton (no button flash)", () => {
    useAuthMock.mockReturnValue({
      ...authDefaults,
      user: null,
      loading: true,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    render(<UserMenu />);
    const skeleton = screen.getByLabelText(/loading/i);
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });

  it("U-AUTH-002b — signed-out renders 'Sign in with Google' and triggers signIn on click", async () => {
    const signIn = vi.fn();
    useAuthMock.mockReturnValue({
      ...authDefaults,
      user: null,
      loading: false,
      signIn,
      signOut: vi.fn(),
    });
    const user = userEvent.setup();
    render(<UserMenu />);
    const btn = screen.getByRole("button", { name: /sign in with google/i });
    await user.click(btn);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("U-AUTH-002c — signed-in customer with photo renders <img> and the role label", () => {
    useAuthMock.mockReturnValue({
      ...authDefaults,
      user: {
        uid: "usr_saeed_h",
        email: "saeedh582@gmail.com",
        role: "customer",
        displayName: "Saeed Hassanpour",
        photoURL: "https://lh3.googleusercontent.com/saeed.jpg",
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    render(<UserMenu />);
    expect(screen.getByText("Saeed Hassanpour")).toBeInTheDocument();
    const roleLine = screen.getByText(/role/i, { selector: "div" });
    expect(roleLine).toHaveTextContent(/customer/i);
    const img = document.querySelector('img[src="https://lh3.googleusercontent.com/saeed.jpg"]');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("U-AUTH-002d — signed-in user without photoURL renders the email-initial fallback", () => {
    useAuthMock.mockReturnValue({
      ...authDefaults,
      user: {
        uid: "usr_donovan_p",
        email: "donovan.park@gmail.com",
        role: "customer",
        displayName: null,
        photoURL: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    render(<UserMenu />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("donovan.park@gmail.com")).toBeInTheDocument();
  });

  it("U-AUTH-002e — sign-out click triggers signOut", async () => {
    const signOut = vi.fn();
    useAuthMock.mockReturnValue({
      ...authDefaults,
      user: {
        uid: "usr_marcus_admin",
        email: "marcus@muga.app",
        role: "admin",
        displayName: "Marcus Reed",
        photoURL: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut,
    });
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replaceWithMock).toHaveBeenCalledWith("/login");
  });

  it("U-AUTH-002f — admin role renders the 'Admin' role label (not 'Customer')", () => {
    useAuthMock.mockReturnValue({
      ...authDefaults,
      user: {
        uid: "usr_erin_editor",
        email: "erin.editor@muga.app",
        role: "admin",
        displayName: "Erin Editor",
        photoURL: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    render(<UserMenu />);
    const roleLine = screen.getByText(/role/i, { selector: "div" });
    expect(roleLine).toHaveTextContent(/admin/i);
    expect(roleLine).not.toHaveTextContent(/customer/i);
  });

  it("U-ROLE-SWITCH-001 — signed-in customer sees demo hint and can switch to admin", async () => {
    const switchRole = vi.fn(async () => undefined);
    useAuthMock.mockReturnValue({
      ...authDefaults,
      user: {
        uid: "usr_saeed_h",
        email: "saeedh582@gmail.com",
        role: "customer",
        displayName: "Saeed Hassanpour",
        photoURL: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      switchRole,
    });
    const user = userEvent.setup();
    render(<UserMenu />);

    expect(screen.getAllByText(/experimental role switcher/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /switch to admin/i }));

    expect(switchRole).toHaveBeenCalledWith("admin");
    expect(screen.getByText(/role switched/i)).toBeInTheDocument();
  });

  it("U-ROLE-SWITCH-002 — admin sees switch-to-customer action and loading disables it", () => {
    useAuthMock.mockReturnValue({
      ...authDefaults,
      switchingRole: true,
      user: {
        uid: "usr_marcus_admin",
        email: "marcus@muga.app",
        role: "admin",
        displayName: "Marcus Reed",
        photoURL: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    render(<UserMenu />);

    const button = screen.getByRole("button", { name: /switching role/i });
    expect(button).toBeDisabled();
  });

  it("U-ROLE-SWITCH-003 — role switch failures surface user-safe error copy", async () => {
    useAuthMock.mockReturnValue({
      ...authDefaults,
      user: {
        uid: "usr_saeed_h",
        email: "saeedh582@gmail.com",
        role: "customer",
        displayName: "Saeed Hassanpour",
        photoURL: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      switchRole: vi.fn(async () => {
        throw new Error("gate disabled");
      }),
    });
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByRole("button", { name: /switch to admin/i }));

    expect(screen.getByText(/role switch failed/i)).toBeInTheDocument();
  });
});

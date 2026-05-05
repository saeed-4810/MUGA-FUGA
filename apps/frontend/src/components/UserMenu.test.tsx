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
import { describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import { UserMenu } from "./UserMenu";

describe("U-AUTH-002: UserMenu", () => {
  it("U-AUTH-002a — loading state renders an aria-busy skeleton", () => {
    useAuthMock.mockReturnValue({
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
      user: {
        uid: "u1",
        email: "c@example.com",
        role: "customer",
        displayName: "Carol Catalog",
        photoURL: "https://photos.example.com/c.jpg",
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    render(<UserMenu />);
    expect(screen.getByText("Carol Catalog")).toBeInTheDocument();
    // Match the role line specifically (the only div containing "Role:")
    const roleLine = screen.getByText(/role/i, { selector: "div" });
    expect(roleLine).toHaveTextContent(/customer/i);
    const img = document.querySelector('img[src="https://photos.example.com/c.jpg"]');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("U-AUTH-002d — signed-in user without photoURL renders the email-initial fallback", () => {
    useAuthMock.mockReturnValue({
      user: {
        uid: "u2",
        email: "donovan@example.com",
        role: "customer",
        displayName: null,
        photoURL: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    render(<UserMenu />);
    // No <img>, but the initial 'D' is shown
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("D")).toBeInTheDocument();
    // displayName falls back to email
    expect(screen.getByText("donovan@example.com")).toBeInTheDocument();
  });

  it("U-AUTH-002e — sign-out click triggers signOut", async () => {
    const signOut = vi.fn();
    useAuthMock.mockReturnValue({
      user: {
        uid: "u3",
        email: "e@example.com",
        role: "admin",
        displayName: "Erin Admin",
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
  });

  it("U-AUTH-002f — admin role renders the 'Admin' role label (not 'Customer')", () => {
    useAuthMock.mockReturnValue({
      user: {
        uid: "u4",
        email: "a@example.com",
        role: "admin",
        displayName: "Erin Editor",
        photoURL: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    render(<UserMenu />);
    // Role row text is "Role: Admin" (i18n combines them via "{label}: {value}").
    // Match the role-line node directly to avoid colliding with display name.
    const roleLine = screen.getByText(/role/i, { selector: "div" });
    expect(roleLine).toHaveTextContent(/admin/i);
    expect(roleLine).not.toHaveTextContent(/customer/i);
  });
});

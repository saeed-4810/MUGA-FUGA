/**
 * U-AUTH-bootstrap — AuthContext lifecycle tests.
 *
 * Covers:
 *   - initial state (loading=true, user=null)
 *   - signed-out branch (firebase emits null)
 *   - signed-in happy path: /me/bootstrap promotes admin via custom claim
 *   - signed-in fallback: bootstrap fails → falls back to customer with no claim refresh
 *   - signIn / signOut methods proxy to the firebase lib
 *   - useAuth throws when used outside <AuthProvider>
 */
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Hoisted controllable state for the firebase lib mock + the api mock.
const fbState: {
  cb: ((u: unknown) => void) | null;
  signInImpl: () => Promise<unknown>;
  signOutImpl: () => Promise<void>;
  getIdTokenImpl: () => Promise<string | null>;
  currentUser: { getIdToken: (force?: boolean) => Promise<string> } | null;
} = {
  cb: null,
  signInImpl: vi.fn(async () => ({})),
  signOutImpl: vi.fn(async () => undefined),
  getIdTokenImpl: vi.fn(async () => "test-token"),
  currentUser: null,
};

vi.mock("../lib/firebase", () => ({
  isFirebaseConfigured: () => true,
  onAuthStateChanged: (cb: (u: unknown) => void) => {
    fbState.cb = cb;
    return () => {
      fbState.cb = null;
    };
  },
  googleSignIn: () => fbState.signInImpl(),
  signOut: () => fbState.signOutImpl(),
  getIdToken: () => fbState.getIdTokenImpl(),
  auth: () => null,
}));

const apiPostMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

import { AuthProvider, isLocalhostUrl, readLocalhostE2eUser, useAuth } from "./AuthContext";

const Probe = () => {
  const { user, loading, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="uid">{user?.uid ?? "anon"}</span>
      <span data-testid="role">{user?.role ?? "none"}</span>
      <span data-testid="email">{user?.email ?? ""}</span>
      <span data-testid="display">{user?.displayName ?? ""}</span>
      <span data-testid="photo">{user?.photoURL ?? ""}</span>
      <button onClick={() => void signIn()}>signin</button>
      <button onClick={() => void signOut()}>signout</button>
    </div>
  );
};

beforeEach(() => {
  fbState.cb = null;
  fbState.signInImpl = vi.fn(async () => ({}));
  fbState.signOutImpl = vi.fn(async () => undefined);
  sessionStorage.clear();
  apiPostMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("U-AUTH-bootstrap: AuthContext", () => {
  it("U-AUTH-CTX-001 — initial state is loading=true with no user", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("uid").textContent).toBe("anon");
  });

  it("U-AUTH-CTX-002 — firebase emits null → user=null, loading=false", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await act(async () => {
      fbState.cb?.(null);
    });
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("uid").textContent).toBe("anon");
    expect(screen.getByTestId("role").textContent).toBe("none");
  });

  it("U-AUTH-CTX-002b — localhost e2e override seeds a customer user", async () => {
    sessionStorage.setItem(
      "muga:e2e-user",
      JSON.stringify({ uid: "e2e-customer", email: "e2e@example.com", role: "customer" })
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("uid").textContent).toBe("e2e-customer");
    expect(screen.getByTestId("role").textContent).toBe("customer");
    expect(fbState.cb).toBeNull();
  });

  it("U-AUTH-CTX-002c — localhost detection rejects non-local URLs", () => {
    expect(isLocalhostUrl("http://localhost:5174/login")).toBe(true);
    expect(isLocalhostUrl("https://muga-staging.web.app/login")).toBe(false);
    expect(readLocalhostE2eUser("https://muga-staging.web.app/login", sessionStorage)).toBeNull();
    expect(readLocalhostE2eUser("http://localhost:5174/login", sessionStorage)).toBeNull();
  });

  it("U-AUTH-CTX-003 — successful sign-in: /me/bootstrap returns admin → role=admin, getIdToken refreshed", async () => {
    apiPostMock.mockResolvedValue({
      uid: "uid-admin",
      email: "admin@example.com",
      role: "admin",
    });
    const refresh = vi.fn(async () => "fresh-token");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await act(async () => {
      fbState.cb?.({
        uid: "uid-admin",
        email: "admin@example.com",
        emailVerified: true,
        displayName: "Adam Admin",
        photoURL: "https://photos/admin.jpg",
        getIdToken: refresh,
      });
    });
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("role").textContent).toBe("admin");
    expect(screen.getByTestId("uid").textContent).toBe("uid-admin");
    expect(screen.getByTestId("email").textContent).toBe("admin@example.com");
    expect(screen.getByTestId("display").textContent).toBe("Adam Admin");
    expect(screen.getByTestId("photo").textContent).toBe("https://photos/admin.jpg");
    expect(apiPostMock).toHaveBeenCalledWith("/me/bootstrap", {});
    // ID token forced refresh so the new claim is in the next request
    expect(refresh).toHaveBeenCalledWith(true);
  });

  it("U-AUTH-CTX-004 — bootstrap failure falls back to customer, no token refresh", async () => {
    apiPostMock.mockRejectedValue(new Error("backend down"));
    const refresh = vi.fn(async () => "stale-token");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await act(async () => {
      fbState.cb?.({
        uid: "uid-cust",
        email: "cust@example.com",
        emailVerified: true,
        displayName: null,
        photoURL: null,
        getIdToken: refresh,
      });
    });
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("role").textContent).toBe("customer");
    expect(screen.getByTestId("uid").textContent).toBe("uid-cust");
    // No forced refresh on the failure branch
    expect(refresh).not.toHaveBeenCalled();
  });

  it("U-AUTH-CTX-004b — fallback when firebase user has no email → email defaults to empty string", async () => {
    apiPostMock.mockRejectedValue(new Error("offline"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await act(async () => {
      fbState.cb?.({
        uid: "uid-no-email",
        email: null,
        getIdToken: vi.fn(async () => ""),
      });
    });
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("email").textContent).toBe("");
    expect(screen.getByTestId("role").textContent).toBe("customer");
  });

  it("U-AUTH-CTX-005 — signIn() calls googleSignIn, signOut() calls signOut", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await user.click(screen.getByText("signin"));
    expect(fbState.signInImpl).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText("signout"));
    expect(fbState.signOutImpl).toHaveBeenCalledTimes(1);
  });

  it("U-AUTH-CTX-006 — useAuth() outside <AuthProvider> throws a clear message", () => {
    const Bare = () => {
      useAuth();
      return null;
    };
    // Suppress React's error-boundary console noise for this expected throw.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Bare />)).toThrow(/useAuth must be used within/);
    errSpy.mockRestore();
  });

  it("U-AUTH-CTX-007 — provider unsubscribes from firebase on unmount", async () => {
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(fbState.cb).not.toBeNull();
    unmount();
    expect(fbState.cb).toBeNull();
  });
});

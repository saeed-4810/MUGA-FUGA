export const SESSION_COOKIE_NAME = "__session";
export const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

export type Role = "admin" | "customer";

export interface SessionUser {
  uid: string;
  email: string;
  role: Role;
  displayName?: string;
  photoURL?: string;
}

export interface DecodedSessionCookie {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  role?: string;
}

export interface SessionAuthClient {
  createSessionCookie: (idToken: string, options: { expiresIn: number }) => Promise<string>;
  verifySessionCookie: (
    sessionCookie: string,
    checkRevoked: boolean
  ) => Promise<DecodedSessionCookie>;
}

export type SessionVerificationResult =
  | { status: "authenticated"; user: SessionUser }
  | { status: "missing" }
  | { status: "invalid" };

export const isValidIdTokenInput = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const createServerSessionCookie = (
  authClient: Pick<SessionAuthClient, "createSessionCookie">,
  idToken: string
): Promise<string> => authClient.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN_MS });

export const toSessionUser = (decoded: DecodedSessionCookie): SessionUser => ({
  uid: decoded.uid,
  email: decoded.email ?? "",
  role: decoded.role === "admin" ? "admin" : "customer",
  ...(decoded.name ? { displayName: decoded.name } : {}),
  ...(decoded.picture ? { photoURL: decoded.picture } : {}),
});

export const verifyServerSessionCookie = async (
  authClient: Pick<SessionAuthClient, "verifySessionCookie">,
  sessionCookie: string | undefined
): Promise<SessionVerificationResult> => {
  if (!sessionCookie) return { status: "missing" };
  try {
    const decoded = await authClient.verifySessionCookie(sessionCookie, true);
    return { status: "authenticated", user: toSessionUser(decoded) };
  } catch {
    return { status: "invalid" };
  }
};

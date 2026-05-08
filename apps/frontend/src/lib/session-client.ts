import type { User } from "firebase/auth";

export const createSession = async (user: Pick<User, "getIdToken">): Promise<void> => {
  const idToken = await user.getIdToken(true);
  const res = await fetch("/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Unable to create server session.");
};

export const destroySession = async (): Promise<void> => {
  const res = await fetch("/session", { method: "DELETE" });
  if (!res.ok) throw new Error("Unable to clear server session.");
};

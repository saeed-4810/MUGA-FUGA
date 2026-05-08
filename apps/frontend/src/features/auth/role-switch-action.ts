"use server";

import { cookies } from "next/headers";

import type { Role } from "../../context/AuthContext";
import { serverApi } from "../../lib/server/api";
import { SESSION_COOKIE_NAME } from "../../lib/server/session";

export type RoleSwitchActionResult =
  | { ok: true; uid: string; email: string; role: Role }
  | { ok: false; message: string };

const isRole = (value: Role): value is Role => value === "admin" || value === "customer";

export async function switchRoleOnServer(role: Role): Promise<RoleSwitchActionResult> {
  if (!isRole(role)) return { ok: false, message: "Invalid role." };

  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return { ok: false, message: "No active server session." };

  try {
    const updated = await serverApi.post<{ uid: string; email: string; role: Role }>(
      "/me/role",
      { role },
      { auth: { sessionCookie } }
    );
    return { ok: true, uid: updated.uid, email: updated.email, role: updated.role };
  } catch {
    return { ok: false, message: "Role switch failed." };
  }
}

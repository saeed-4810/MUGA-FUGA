import { Router, type Router as ExpressRouter } from "express";

import type { Env } from "../config/env.js";
import { Role } from "../domain/auth.js";
import { Errors } from "../domain/errors.js";
import { auth as adminAuth } from "../lib/firebase.js";
import { requireAuth } from "../middleware/auth.js";

export const meRouter = (env: Env): ExpressRouter => {
  const router = Router();
  router.use(requireAuth(env));

  router.get("/", (req, res) => {
    res.json(req.user);
  });

  router.post("/bootstrap", async (req, res, next) => {
    try {
      const user = req.user!;
      const isInitialAdmin = env.INITIAL_ADMIN_EMAILS.includes(user.email.toLowerCase());
      const desiredRole = user.role === "admin" || isInitialAdmin ? "admin" : "customer";
      if (user.role !== desiredRole) {
        await adminAuth(env).setCustomUserClaims(user.uid, { role: desiredRole });
      }
      res.json({ uid: user.uid, email: user.email, role: desiredRole });
    } catch (err) {
      next(err);
    }
  });

  router.post("/role", async (req, res, next) => {
    try {
      if (!env.EXPERIMENTAL_ROLE_SWITCH_ENABLED) {
        throw Errors.forbidden("Experimental role switch is disabled");
      }

      const parsedRole = Role.safeParse((req.body as { role?: unknown }).role);
      if (!parsedRole.success) {
        throw Errors.validation({ role: "Role must be either admin or customer" });
      }

      const user = req.user!;
      await adminAuth(env).setCustomUserClaims(user.uid, { role: parsedRole.data });
      res.json({ uid: user.uid, email: user.email, role: parsedRole.data, experimental: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};

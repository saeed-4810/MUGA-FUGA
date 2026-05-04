import { Router, type Router as ExpressRouter } from "express";

import type { Env } from "../config/env.js";
import { auth as adminAuth } from "../lib/firebase.js";
import { requireAuth } from "../middleware/auth.js";

export const meRouter = (env: Env): ExpressRouter => {
  const router = Router();
  router.use(requireAuth(env));

  // GET /me — current authenticated user (CTR-001)
  router.get("/", (req, res) => {
    res.json(req.user);
  });

  // POST /me/bootstrap — first-sign-in bootstrapping. If the email is in
  // INITIAL_ADMIN_EMAILS and no role claim exists yet, set it to admin.
  // Otherwise the role defaults to "customer".
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

  return router;
};

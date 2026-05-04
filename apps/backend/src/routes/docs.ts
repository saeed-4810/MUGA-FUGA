import { Router, type Router as ExpressRouter } from "express";
import swaggerUi from "swagger-ui-express";

import { openApiSpec } from "../config/openapi.js";

export const docsRouter = (): ExpressRouter => {
  const router = Router();
  router.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  router.get("/api/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });
  return router;
};

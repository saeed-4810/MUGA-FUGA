import type { RequestHandler } from "express";
import { v4 as uuid } from "uuid";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const id = incoming && incoming.length <= 128 ? incoming : uuid();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
};

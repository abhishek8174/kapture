"use strict";

const express = require("express");
const { getHealthPayload, processWebhookBody } = require("../lib/webhook-core");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json(getHealthPayload());
});

app.post("/webhook", (req, res) => {
  const result = processWebhookBody(req.body, console);
  return res.status(result.statusCode).json(result.body);
});

app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
  if (typeof next === "function") {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`kapture-mock-server listening on port ${PORT}`);
});

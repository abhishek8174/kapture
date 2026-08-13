"use strict";

const { processWebhookBody } = require("../lib/webhook-core");

module.exports = function webhookHandler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const result = processWebhookBody(req.body, console);
  return res.status(result.statusCode).json(result.body);
};

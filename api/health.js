"use strict";

const { getHealthPayload } = require("../lib/webhook-core");

module.exports = function healthHandler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json(getHealthPayload());
};

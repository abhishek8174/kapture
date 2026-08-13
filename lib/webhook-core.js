"use strict";

const VALID_CODES = new Set(["1234", "1995"]);
const DISPOSITIONS = new Set([
  "PTP_COMMITTED",
  "DNC_REQUESTED",
  "WRONG_PERSON",
  "NO_INPUT",
  "ABUSIVE_TERMINATED",
  "AUTH_FAILED",
  "DISPUTE_ESCALATED",
  "HARDSHIP_ESCALATED",
  "ALREADY_PAID_REVIEW",
  "CALL_DROPPED",
  "TECHNICAL_FAILURE"
]);

function randomId(prefix) {
  const value = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${value}`;
}

function maskName(name) {
  if (typeof name !== "string" || name.trim().length === 0) {
    return name;
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const first = parts[0];
    return `${first.slice(0, 2)}****`;
  }
  const first = parts[0];
  const secondInitial = parts[1].charAt(0) || "";
  return `${first} ${secondInitial}****`;
}

function maskAccountId(accountId) {
  if (typeof accountId !== "string") {
    return accountId;
  }
  if (accountId.length <= 4) {
    return "****";
  }
  const start = accountId.slice(0, 5);
  const end = accountId.slice(-1);
  return `${start}***${end}`;
}

function maskPhone(phone) {
  if (typeof phone !== "string") {
    return phone;
  }
  const cleaned = phone.replace(/\s+/g, "");
  if (cleaned.length < 6) {
    return "***";
  }
  return `${cleaned.slice(0, 3)}*****${cleaned.slice(-2)}`;
}

function maskVerificationCode(code) {
  if (typeof code !== "string") {
    return code;
  }
  if (code.length <= 1) {
    return "*";
  }
  return `${code.charAt(0)}***`;
}

function maskPayload(data) {
  if (Array.isArray(data)) {
    return data.map(maskPayload);
  }

  if (data && typeof data === "object") {
    const masked = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "customer_name" || key === "name") {
        masked[key] = maskName(value);
      } else if (key === "account_id") {
        masked[key] = maskAccountId(value);
      } else if (key === "phone") {
        masked[key] = maskPhone(value);
      } else if (key === "verification_code") {
        masked[key] = maskVerificationCode(value);
      } else {
        masked[key] = maskPayload(value);
      }
    }
    return masked;
  }

  return data;
}

function parseToolArguments(raw) {
  if (!raw) {
    return {};
  }
  if (typeof raw === "object") {
    return raw;
  }
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }
  throw new Error("Unsupported tool arguments format");
}

function getToolCallsFromBody(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  if (Array.isArray(body.toolCalls)) {
    return body.toolCalls;
  }

  if (body.message && body.message.type === "tool-calls" && Array.isArray(body.message.toolCalls)) {
    return body.message.toolCalls;
  }

  return null;
}
function normalizeCode(raw) {
  return String(raw).replace(/[^0-9]/g, ""); // strip everything except digits
}

function handleVerifyCustomer(args) {
  const { account_id, verification_code } = args;

  if (!account_id || !verification_code) {
    throw new Error("verify_customer requires account_id and verification_code");
  }

  const cleaned = normalizeCode(verification_code);
  const success = VALID_CODES.has(cleaned);
  if (success) {
    return {
      status: "success",
      verified: true,
      customer_name: "Rahul Sharma",
      account_id,
      verified_at: new Date().toISOString()
    };
  }

  return {
    status: "failed",
    verified: false,
    attempts_remaining: 2,
    message: "Verification code mismatch"
  };
}

function handleLogPromiseToPay(args) {
  const { account_id, ptp_date, ptp_amount, notes } = args;

  if (!account_id || !ptp_date || typeof ptp_amount !== "number") {
    throw new Error("log_promise_to_pay requires account_id, ptp_date, and numeric ptp_amount");
  }

  return {
    status: "SUCCESS",
    ptp_id: randomId("PTP"),
    account_id,
    ptp_date,
    ptp_amount,
    notes: notes || "",
    recorded_at: new Date().toISOString()
  };
}

function handleSendPaymentLink(args) {
  const { account_id, channel, phone } = args;

  if (!account_id || !channel) {
    throw new Error("send_payment_link requires account_id and channel");
  }

  const normalized = String(channel).toUpperCase();
  if (normalized !== "SMS" && normalized !== "WHATSAPP") {
    throw new Error("send_payment_link channel must be SMS or WHATSAPP");
  }

  return {
    link_sent: true,
    channel: normalized,
    reference_id: randomId("PAY"),
    destination: phone || "primary_on_file",
    sent_at: new Date().toISOString()
  };
}

function handleMarkDisposition(args) {
  const { account_id, disposition, timestamp, notes } = args;

  if (!account_id || !disposition || !timestamp) {
    throw new Error("mark_disposition requires account_id, disposition, and timestamp");
  }

  if (!DISPOSITIONS.has(disposition)) {
    throw new Error("mark_disposition received unsupported disposition");
  }

  return {
    status: "RECORDED",
    account_id,
    disposition,
    event_timestamp: timestamp,
    notes: notes || "",
    logged_at: new Date().toISOString()
  };
}

function handleEscalateToAgent(args) {
  const { account_id, reason, context } = args;

  if (!account_id || !reason) {
    throw new Error("escalate_to_agent requires account_id and reason");
  }

  if (reason !== "HARDSHIP_REQUEST" && reason !== "DISPUTE") {
    throw new Error("escalate_to_agent reason must be HARDSHIP_REQUEST or DISPUTE");
  }

  return {
    status: "QUEUED",
    ticket_id: randomId("ESC"),
    account_id,
    reason,
    context: context || "",
    eta_minutes: 20,
    queued_at: new Date().toISOString()
  };
}

function executeTool(name, args) {
  switch (name) {
    case "verify_customer":
      return handleVerifyCustomer(args);
    case "log_promise_to_pay":
      return handleLogPromiseToPay(args);
    case "send_payment_link":
      return handleSendPaymentLink(args);
    case "mark_disposition":
      return handleMarkDisposition(args);
    case "escalate_to_agent":
      return handleEscalateToAgent(args);
    default:
      throw new Error(`Unsupported tool name: ${name}`);
  }
}

function processWebhookBody(body, logger = console) {
  const toolCalls = getToolCallsFromBody(body);

  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return {
      statusCode: 400,
      body: {
        error: "Malformed payload: expected tool-calls message with non-empty toolCalls array"
      }
    };
  }

  try {
    const results = toolCalls.map((toolCall) => {
      const toolCallId = toolCall.id || toolCall.toolCallId;
      const fn = toolCall.function || {};
      const toolName = fn.name;
      const args = parseToolArguments(fn.arguments);

      if (!toolCallId || !toolName) {
        throw new Error("Each toolCall must include id and function.name");
      }

      const maskedRequest = maskPayload({ toolCallId, toolName, args });
      logger.log("[webhook] Incoming tool call:", JSON.stringify(maskedRequest));

      const result = executeTool(toolName, args);
      const maskedResponse = maskPayload({ toolCallId, result });
      logger.log("[webhook] Tool result:", JSON.stringify(maskedResponse));

      return { toolCallId, result };
    });

    return {
      statusCode: 200,
      body: { results }
    };
  } catch (error) {
    logger.error("[webhook] Tool execution error:", error.message);
    return {
      statusCode: 400,
      body: { error: error.message }
    };
  }
}

function getHealthPayload() {
  return {
    status: "ok",
    service: "kapture-mock-server",
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getHealthPayload,
  processWebhookBody,
  _internals: {
    maskPayload,
    parseToolArguments,
    getToolCallsFromBody,
    executeTool
  }
};

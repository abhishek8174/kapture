# Kapture Collections Voicebot

Kapture Collections Voicebot is a submission-ready outbound Voice AI collections project for a fictional lender, Kapture Finance. The voice agent, Maya, is designed for Vapi.ai to compliantly verify customer identity, negotiate promise-to-pay commitments, handle hardship/dispute escalations, and record structured call outcomes with strict no-debt-disclosure guardrails prior to authentication.

## Architecture Summary

The end-to-end architecture and compliance flow are documented in detail in [docs/HLD_Document.md](docs/HLD_Document.md). The core sequence uses Telephony -> Vapi -> Deepgram STT -> GPT-4o orchestration -> ElevenLabs/Cartesia TTS -> Telephony playback, with strict auth gating before collections disclosure.

A standalone Mermaid source for the architecture diagram is available at [docs/System_Architecture.mmd](docs/System_Architecture.mmd).

To export Mermaid source to PNG for documentation:

```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i docs/System_Architecture.mmd -o docs/System_Architecture.png
```

## Project Structure

```text
kapture-collections-voicebot/
├── README.md
├── docs/
│   ├── HLD_Document.md
│   ├── System_Architecture.png
│   └── System_Architecture.mmd
├── vapi/
│   ├── system_prompt.txt
│   └── tool_definitions.json
├── mock-server/
│   ├── package.json
│   ├── server.js
│   └── .env.example
└── tests/
    └── test_cases.json
```

## Setup Instructions

1. Clone and open the repository in VS Code.

```bash
git clone <your-repo-url>
cd kapture-collections-voicebot
```

2. Install mock server dependencies.

```bash
cd mock-server
npm install
```

3. Run the webhook server.

```bash
node server.js
```

4. Expose local server publicly with ngrok.

```bash
ngrok http 3000
```

5. Copy the HTTPS forwarding URL from ngrok and configure Vapi tools.
- In Vapi Assistant > Tools tab, create/import the five tools from [vapi/tool_definitions.json](vapi/tool_definitions.json).
- Set each tool webhook URL to `https://<your-ngrok-id>.ngrok-free.app/webhook`.

## Vapi Assistant Configuration

Configure assistant with the following values:

- Transcriber: Deepgram `nova-2`
- Model: GPT-4o
- Temperature: `0.1`
- Voice provider: ElevenLabs or Cartesia
- First Message:
  - "Hello, am I speaking with Rahul Sharma? This is Maya from Kapture Finance customer support."
- System Prompt:
  - Paste full content from [vapi/system_prompt.txt](vapi/system_prompt.txt)
- Tool Schemas:
  - Import JSON from [vapi/tool_definitions.json](vapi/tool_definitions.json)

## Demo Scenarios (Vapi Web Call)

### Scenario 1: Happy Path PTP Flow

1. Start web call test.
2. User confirms identity and shares valid verification code (`1234` or `1995`).
3. Agent discloses dues after verification.
4. User commits to payment date/amount.
5. Observe tool sequence:
- `verify_customer`
- `log_promise_to_pay`
- `send_payment_link`
- `mark_disposition` with `PTP_COMMITTED`

Expected result: call ends with a confirmed PTP and link sent.

### Scenario 2: Edge Case - DNC Request

1. Start web call test and complete verification.
2. User says: "Do not call me again."
3. Agent immediately opts out and ends call.

Expected tool sequence:
- `mark_disposition` with `DNC_REQUESTED`

Expected result: no further collection dialogue after opt-out.

## Design Choices

- GPT-4o with low temperature (`0.1`): chosen for deterministic, compliance-sensitive dialogue where variability can create policy risk.
- Deepgram Nova-2 STT: selected for strong low-latency transcription performance for conversational turn-taking.
- Strict state machine gate: `AUTH_PENDING -> AUTHENTICATED` is only unlocked by `verify_customer(status=success, verified=true)` to prevent accidental pre-auth debt disclosure.

## Known Limitations / Future Enhancements

- No persistent storage: mock server returns simulated outputs and does not persist dispositions/PTP records.
- No real payment gateway integration: payment links are mocked references only.
- Limited language validation: bilingual handling is prompt-driven and not backed by dedicated Hindi NLU test corpus.
- No automatic retry/backoff strategy for external API faults beyond simple safe fallback behavior.
- No campaign scheduler or timezone-aware dialer included in this repo.
- No authentication signature validation for webhook requests in the mock server.

## Debugging Log

| Issue | Root Cause | Fix |
|---|---|---|
| Tool call appears in Vapi but no response returned | Webhook payload used `toolCalls` nested under `message`, while server expected top-level only | Updated parser to accept both formats and validate non-empty array |
| Silent tool failure in assistant flow | Function schema required fields mismatched with tool arguments names | Unified schema and server handler fields (`account_id`, `ptp_date`, `ptp_amount`) |
| Assistant started with debt statement in test | First Message not aligned with STATE 0 greeting | Replaced first message with identity-only greeting; moved debt disclosure post-auth |

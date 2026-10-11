# Skepticall 🔒

**Private messaging, voice and video calls, and file sharing, where the server is a delivery pipe, not your chat history.**

🌐 Live: [skepticall.com](https://www.skepticall.com)

<!-- FILL IN: 2-3 screenshots or a short GIF (a chat, a call) -->

## What it does

- 💬 **Direct and group messaging** in real time (WebSockets / STOMP): replies, edits, deletes, voice messages, images, video and files
- ⏳ **Self-destructing messages** (`/tempo`)
- 📞 **Voice and video calls**, one-to-one and group (WebRTC, signaling over the same WebSocket)
- 👥 Friends, presence, notifications and push notifications
- 🔐 **End-to-end encrypted** content and media (see below)

## How a message travels

1. The sender's client encrypts the message **on the device** and sends the ciphertext over a WebSocket.
2. The server stores it in PostgreSQL (the durable copy) and keeps a fast copy in Redis. Redis is best-effort only: if it restarts or evicts, the inbox is rebuilt from the database, so a pending message is never lost.
3. The recipient's device collects it and sends back a **delivery ack** after it has stored the message locally.
4. About **5 minutes after the ack**, the server deletes the message and its media from storage. A message nobody collects is deleted after **30 days**.
5. Long-term history lives on the users' devices, not on the server.

The delay and the maximum age are configurable (`messages.purge.delivered-after-minutes`, `messages.purge.max-pending-days`). Purging is off by default and enabled with `MESSAGES_PURGE_ENABLED=true`.

> The server holds messages for a short time (while waiting for delivery, and for a few minutes after). It does not keep them beyond that.

## Encryption

- Each account has an **X25519 key pair generated on the device**. The server only ever stores the public key.
- **Direct messages:** `crypto_box` (public-key authenticated encryption) with a fresh random nonce per message. Reply previews are encrypted separately so a reply doesn't leak the quoted text.
- **Media:** each file is encrypted with its own random symmetric key (`crypto_secretbox`); that key is then wrapped for the recipient with `crypto_box`. The file in object storage is ciphertext.
- **Groups:** each message is encrypted once with a random key, and that key is wrapped separately for every member, so only a member's own private key can unwrap it.
- **Not hidden from the server:** metadata such as who talked to whom, when, message type, and call logs. Call-log entries are not purged. Accounts without a public key (older accounts) still send plaintext.

<!-- FILL IN: where the client-side crypto lives (e.g. the mobile app / a shared module), which library it uses, and whether the web client encrypts. Keep this honest. -->

## Trade-offs (by design)

- **No server-side history.** If you lose your device or reinstall, history can't be restored from the server.
- **Metadata is visible** to the server even though content isn't.

## Status

| | |
|---|---|
| ✅ Done | Messaging, groups, calls, media, encryption, delivery acks, automatic deletion after delivery |
| 🚧 In progress | Saving full message history on the device |
| 📋 Planned | Local backup of history, restorable only by the account that created it |

## Tech stack

- **Backend:** Java 21, Spring Boot, PostgreSQL, Redis, WebSockets (STOMP)
- **Real-time media:** WebRTC
- **Auth:** JWT, remember-me cookie, BCrypt, reCAPTCHA, email verification (Brevo)
- **Storage:** Cloudflare R2
- **Push notifications:** Expo
- **Web client:** React, deployed on Cloudflare
- **Mobile client:** React Native
- **Infra:** Docker (ffmpeg for media metadata scrubbing), hosted on Render

## Running locally

<!-- FILL IN with the real commands. Backend: cd backend && ./mvnw spring-boot:run (needs the env vars below). Frontend: cd frontend && npm install && npm start. -->

Required environment variables (names only):
`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `REDIS_HOST`, `REDIS_PORT`, `BREVO_API_KEY`, `RECAPTCHA_SECRET_KEY`, `ADMIN_BOOTSTRAP_EMAIL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `FRONTEND_ORIGINS`, `MESSAGES_PURGE_ENABLED`; optional: `JWT_EXPIRATION_MS`, `MESSAGES_PURGE_DELIVERED_AFTER_MINUTES`, `MESSAGES_PURGE_MAX_PENDING_DAYS`

## Project status

Independently developed and still evolving.

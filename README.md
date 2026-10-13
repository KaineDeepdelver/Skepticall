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
- **Rerolling your key:** you can generate a new key pair at any time (`POST /users/me/public-key/rotate`, needs your password; at most once an hour). The new key takes over immediately, and the **old key stays valid for 30 days**, so messages encrypted to it by contacts with a stale key, or queued while you were offline, still open. Your devices keep the old private keys for those 30 days and then wipe them. Clients learn which keys are valid from `GET /users/me/public-keys` (yours) and `GET /users/{id}/public-keys` (a contact's, to open their older messages).
- **Not hidden from the server:** metadata such as who talked to whom, when, message type, and call logs. Call-log entries are not purged. Accounts without a public key (older accounts) still send plaintext.

<!-- FILL IN: where the client-side crypto lives (e.g. the mobile app / a shared module), which library it uses, and whether the web client encrypts. Keep this honest. -->

## Trade-offs (by design)

- **No server-side history.** If you lose your device or reinstall, history can't be restored from the server.
- **Metadata is visible** to the server even though content isn't.

## Backups

A backup is a single `.dat` file: your data is compressed (gzip) and then encrypted (XSalsa20-Poly1305, key from your passphrase via Argon2id). The file can be copied, stored or shared anywhere; without the passphrase it is random bytes.

It can only be restored into **the account that created it**: the backup carries that account's private keys (the current one plus any recently rerolled ones), and restore is refused unless one of them matches a public key the server currently lists as valid for the logged-in account. A backup from account A can't be loaded into account B, even by someone who knows the passphrase.

Details, threat model and the integration contract: [`frontend/src/backup/README.md`](frontend/src/backup/README.md).

## Status

| | |
|---|---|
| ✅ Done | Messaging, groups, calls, media, encryption, delivery acks, automatic deletion after delivery, backup file format (encrypt, compress, account-bound; unit-tested) |
| 🚧 In progress | Saving message history on the device; wiring backup export/restore into the apps |

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
`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `REDIS_HOST`, `REDIS_PORT`, `BREVO_API_KEY`, `RECAPTCHA_SECRET_KEY`, `ADMIN_BOOTSTRAP_EMAIL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `FRONTEND_ORIGINS`, `MESSAGES_PURGE_ENABLED`; optional: `KEYS_RETIRED_GRACE_DAYS` (default 30), `KEYS_ROTATION_MIN_INTERVAL_MINUTES` (default 60), `JWT_EXPIRATION_MS`, `MESSAGES_PURGE_DELIVERED_AFTER_MINUTES`, `MESSAGES_PURGE_MAX_PENDING_DAYS`

## Project status

Independently developed and still evolving.

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
- **Always encrypted:** the server refuses any message that isn't end-to-end encrypted (call logs excepted). It can't read ciphertext, so it checks the shape: a 24-byte nonce, tag-sized ciphertext, a wrapped file key, and for groups a content key wrapped for every member. The clients also refuse to send when they can't encrypt (for example, the recipient hasn't set up a key). Switch the server check off with `MESSAGES_REQUIRE_ENCRYPTION=false`.
- **Not hidden from the server:** metadata such as who talked to whom, when, message type, and call logs. Call-log entries are not purged. Older accounts without a public key can't send or receive new messages until they set one up.

Encryption happens in the clients, never on the server: the web client in [`frontend/src/e2e`](frontend/src/e2e/README.md) (tweetnacl) and the mobile app (`e2e.js`, not in this repo). Both follow the backend's wire format.

## Trade-offs (by design)

- **No server-side history.** If you lose your device or reinstall, history can't be restored from the server.
- **Metadata is visible** to the server even though content isn't.

## Backups

A backup is a `.dat` file: data compressed with gzip, then encrypted. There are two kinds, neither tied to a device:

- **Message backup:** sealed to your account's own key pair. It needs no passphrase and contains no private key, so it can be copied or shared freely. Opening it needs your account key, and restore is refused unless the backup belongs to the logged-in account.
- **Key backup:** your private key(s), protected by a passphrase. It is how you move your key to a new browser or phone, after which message backups open there too.

Details, threat model and the integration contract: [`frontend/src/backup/README.md`](frontend/src/backup/README.md).

## Status

| | |
|---|---|
| ✅ Done | Messaging, groups, calls, media, encryption, delivery acks, automatic deletion after delivery, backup file format (encrypt, compress, account-bound; unit-tested) |
| 🚧 In progress | Saving message history on the device; wiring backup export/restore into the apps |

## Privacy & compliance

Legal pages (Terms, Privacy, Cookie, Refund, data deletion), a cookie-consent banner, consent records, a real account-erasure flow and an accessibility pass are built in. See [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) for the checklist, what you still need to fill in (operator details), and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for licences.

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
`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `REDIS_HOST`, `REDIS_PORT`, `BREVO_API_KEY`, `RECAPTCHA_SECRET_KEY`, `ADMIN_BOOTSTRAP_EMAIL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `FRONTEND_ORIGINS`, `MESSAGES_PURGE_ENABLED`; optional: `MESSAGES_REQUIRE_ENCRYPTION` (default true), `REQUIRE_SIGNUP_CONSENT`, `MIN_AGE`, `TERMS_VERSION`, `FRONTEND_URL`, `LEGAL_BUSINESS_NAME`, `LEGAL_CONTACT_EMAIL`, `LEGAL_BUSINESS_ADDRESS`, `MESSAGES_PURGE_CALL_LOG_DAYS`, `KEYS_RETIRED_GRACE_DAYS` (default 30), `KEYS_ROTATION_MIN_INTERVAL_MINUTES` (default 60), `JWT_EXPIRATION_MS`, `MESSAGES_PURGE_DELIVERED_AFTER_MINUTES`, `MESSAGES_PURGE_MAX_PENDING_DAYS`

## Project status

Independently developed and still evolving.

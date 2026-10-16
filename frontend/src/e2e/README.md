# End-to-end encryption in the web client

The server never sees plaintext: it stores and relays ciphertext (see `Message.java`,
`GroupMessage.java`, `GroupMessageKey.java` on the backend). This folder is the web client's side.

| File | What it does |
|---|---|
| `box.js` | Pure crypto for the wire format (text, files, group keys). |
| `keyStore.js` | Keeps the account's private keys in this browser (IndexedDB). |
| `e2eeService.js` | Key setup, finding other people's keys, encrypt on send, decrypt on receive, encrypted files. |
| `E2EEContext.js` | React provider: starts the service for the logged-in user. |
| `EncryptionGate.js` | The "turn on encryption" / "unlock this browser" dialog, and the Settings backup button. |
| `useMessageFiles.js` | Hook that downloads and decrypts a message's file for display. |

## Wire format (matches the backend fields)

Everything is standard base64. Keys are X25519, boxes are NaCl `box` (XSalsa20-Poly1305).

- **Direct message:** `content` = box(text, nonce, recipientPublic, senderSecret), `nonce`.
  Reply preview the same way with `replyPreviewNonce` (the sender name stays plain).
  The sender can open their own message with the recipient's public key.
- **Direct file:** the uploaded bytes are `secretbox(file, mediaNonce, K)` with a random 32-byte `K`;
  `K` travels as `mediaKeyCiphertext` / `mediaKeyNonce` (a box, like text).
- **Group message:** one random content key per message; text and reply preview are `secretbox`ed
  with it (own nonces); the key is wrapped for every member in `recipientKeys`
  (`{recipientId, keyType: "CONTENT", wrappedKey, wrappedKeyNonce}`), the sender included.
  Files use their own `MEDIA` key and `mediaNonce`. Multipart uploads send `recipientKeysJson`.
- **Always encrypted.** The backend rejects user-sent messages without valid ciphertext (`EncryptionPolicy`), and this client
  never falls back to plain text. Old plaintext history still displays.

## Key lifecycle

| State | When | What the user sees |
|---|---|---|
| `ready` | The browser holds the account's current key | Nothing: messages just work |
| `needs-setup` | The account has no key | "Turn on encryption" (needs the password): required, can't be skipped |
| `needs-restore` | The account has a key, this browser doesn't | Restore from a `.dat` backup, or start fresh with a new key |

- **Sign-up** generates the key pair in the browser and sends only the public key. The private key
  is stored under the username and adopted at the first login.
- **Rerolled keys** stay valid 30 days (see `PublicKeyService`). The ring keeps older private keys so
  old messages open; they are wiped once the server stops listing them.
- **One key per account.** A second browser or device can only read new messages if it has the
  same key: export a backup from Settings > Security and restore it there. "Start fresh" creates a
  new key, after which other devices keep reading new messages only until the old key expires.

## Not done / limits

- **No delivery acks and no local history.** The web client doesn't send `/app/message.delivered`
  and doesn't store history. Messages stay on the server (as ciphertext) until the other side acks or
  30 days pass, so the web app shows what the server still has. Local history is the next step.
- **Sending without a key is refused.** If the recipient (or any group member) has no key, the message isn't sent and the
  user sees why. Nothing is ever sent in plain text.
- **Files** over 64 MB aren't sent encrypted (decryption happens in memory, on the main thread).
- **R2 needs CORS.** Encrypted files are fetched with `fetch()` and decrypted in the browser, so the
  bucket must allow `GET` from the web origin.
- **Keys sit in browser storage.** XSS or someone using the browser profile could read them.
- **Untested against the mobile app.** The formats follow the backend's field documentation. Send a
  message each way between web and mobile before relying on it.

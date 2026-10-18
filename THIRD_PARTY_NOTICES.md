# Third-party notices

What Skepticall ships to visitors' browsers, and under which licence. (Build-only tools such as
Create React App, ESLint and Jest are not shipped and aren't listed.) Last checked: 16 October 2026,
from `frontend/package-lock.json`.

## Libraries bundled into the web app

| Package | Licence | Used for |
|---|---|---|
| react, react-dom | MIT | UI |
| react-router-dom | MIT | Routing |
| react-hot-toast | MIT | Notifications |
| @stomp/stompjs, sockjs-client | Apache-2.0, MIT | Real-time messaging |
| tweetnacl, tweetnacl-util | Unlicense (public domain) | Encryption (NaCl) |
| @noble/hashes | MIT | Argon2id and HKDF for backups |
| pako | MIT AND Zlib | Compression for backups |
| @fontsource/inter (Inter typeface) | SIL Open Font Licence 1.1 | The app's font, served from our own origin |

All 1,300+ production dependencies in the lock file are under permissive licences (MIT, ISC,
BSD, Apache-2.0, CC0, 0BSD, Unlicense, MPL-2.0, OFL-1.1). The only dual-licensed entry is
`node-forge` (BSD-3-Clause OR GPL-2.0), which is used by build tooling, not shipped, and available under BSD-3-Clause.
There are no GPL/AGPL-only packages.

## Icons

The small line icons drawn inline in `LandingPage.js` follow the shapes of [Feather](https://feathericons.com)
icons, MIT licence, Copyright (c) 2013-2017 Cole Bemis.

## Assets whose origin needs confirming

These files are in the repository and I could not verify where they came from or what licence applies. Please
confirm you made them or have the right to use them, or replace them:

- `frontend/src/ringtone.mp3` (call ringtone)
- `frontend/src/teddy_no_results.png` (empty-search illustration)

## Not covered here

- Backend (Maven) dependencies: run `./mvnw dependency:tree` or a licence plugin before publishing a list.
- Third-party services are described in the Privacy Policy and in `docs/COMPLIANCE.md`.

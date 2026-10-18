# Website compliance checklist: status

This maps the 20-point website compliance checklist to what was done in the code, what you still
have to do, and where to look. **I'm not a lawyer.** The policy texts are written from what the code
actually does and are a solid draft, but have them reviewed for your country before relying on them.

## Things only you can do

1. **Fill in the operator details** (shown on the legal pages, in the site footer and in email footers):
   web `.env` → `REACT_APP_BUSINESS_NAME`, `REACT_APP_BUSINESS_ADDRESS`, `REACT_APP_CONTACT_EMAIL`
   (optional `REACT_APP_BUSINESS_REGISTRATION`, `REACT_APP_BUSINESS_COUNTRY`); backend env →
   `LEGAL_BUSINESS_NAME`, `LEGAL_CONTACT_EMAIL`, `LEGAL_BUSINESS_ADDRESS`, `FRONTEND_URL`.
2. **Get the Terms and Privacy Policy reviewed** for where you operate (EU/UK GDPR, US state laws, etc.).
3. **Check the processor list** in the Privacy Policy (Render, Neon, Cloudflare, Brevo, Metered, Google, Expo)
   and the retention of your hosts' logs and backups. I could only see what the code uses.
4. **Confirm the licence of `ringtone.mp3` and `teddy_no_results.png`** (see `THIRD_PARTY_NOTICES.md`).
5. **Decide the minimum age** (`MIN_AGE` backend, `REACT_APP_MIN_AGE` web; default 16). 13 is common outside the EU.
6. **Old IP addresses:** accounts that signed in before this change still hold a full IP in the database. Clear them:
   `UPDATE users SET last_login_ip = NULL;` (check the column name in your schema first).
7. **Tighten the CSP** in `frontend/public/_headers` (`connect-src`) to your exact API and file hosts.
8. **Mobile app:** it must send `tosAccepted` and `ageConfirmed` when registering, refresh tokens (see below),
   and send `Authorization` on conversation history. Or set `REQUIRE_SIGNUP_CONSENT=false` / `JWT_EXPIRATION_MS=604800000` while it catches up.

## The 20 items

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Privacy policy | Rewritten from the code (the old one said media was stored "locally", that only Brevo was used and that no persistent cookies existed: all untrue). Needs legal review | `pages/PrivacyPolicyPage.js` |
| 2 | Terms of service | Rewritten: age, encryption and key loss, acceptable use, termination, liability, governing law | `pages/TermsPage.js` |
| 3 | Refund policy | Added. True today because nothing is sold (no payment code exists). Update it if you ever charge | `pages/RefundPolicyPage.js` |
| 4 | Cookie policy | Added; lists every storage key the app uses. A test fails if a new key is added without being listed | `pages/CookiePolicyPage.js`, `pages/legal.test.js` |
| 5 | Cookie consent banner | Added. The only optional item is Google reCAPTCHA; it loads only after consent. Accept and Reject look identical. Reopen from "Cookie settings" in any footer | `consent/` |
| 6 | Form consents | Sign-up has separate, unticked checkboxes for the Terms/Privacy Policy and for age. Recorded on the account (time, terms version) and enforced by the server | `SignUp.js`, `UserService.register`, `User` |
| 7 | No unnecessary data | See "Data minimisation" below | |
| 8 | Third-party SDKs | See "Third parties" below | |
| 9 | Dark patterns | Audited, see below | |
| 10 | Hidden fees | None: there is no payment code. Stated on the refund page | |
| 11 | Fake reviews | None exist (no testimonials, ratings or user counts anywhere). A test rejects superlatives on the landing page | `LandingPage.test.js` |
| 12 | Unsupported claims | Fixed: the landing page, Privacy Policy and README no longer claim history lives on your device or that nothing is archived | `LandingPage.js` |
| 13 | Alt text | Every `<img>` has alt text; generic ones ("img", "preview", "me") made descriptive; send button labelled | various |
| 14 | Colour contrast | Measured (WCAG). Dark-theme muted text failed (3.6:1 to 4.2:1), now 5.1:1+. Accent colour used as text is computed per theme and accent to reach 4.5:1 | `global.css`, `ThemeContext.js` |
| 15 | Keyboard navigation | Visible focus ring everywhere; mouse-only controls (clickable divs) get Tab/Enter/Space support automatically; skip links on the landing and legal pages; Esc closes the cookie panel | `a11y/keyboard.js`, `global.css` |
| 16 | Business details | Configurable, shown on legal pages, footer and in emails. **You must supply them** (above) | `config/business.js` |
| 17 | Age consent | Confirmation checkbox, minimum age configurable, recorded and enforced server-side. No date of birth is collected (data minimisation). A tick is a declaration, not verification | `SignUp.js` |
| 18 | Unsubscribe link in emails | Every email has a footer saying why you got it and who sent it. The one optional email (new sign-in alert) has a one-click "turn off" link. Verification codes and password resets are security messages and can't be turned off. There is no marketing email | `EmailService`, `EmailPreferencesPage.js` |
| 19 | Licences for fonts/images | Inter is self-hosted (OFL). All npm packages are permissive. Two asset files need you to confirm their origin | `THIRD_PARTY_NOTICES.md` |
| 20 | Data deletion request | Settings → Delete account now really erases everything (before, it deleted only the user row, which would fail or leave orphans). Public flow for people who can't sign in: enter email → emailed 1-hour link → confirm | `AccountErasureService`, `PrivacyService`, `DataDeletionPage.js` |

### Data minimisation (item 7)

- IP addresses are stored as the network only (`203.0.113.0`, IPv6 `/48`), never exact.
- Call history is deleted after 30 days (`MESSAGES_PURGE_CALL_LOG_DAYS`); retired encryption keys after 30 days.
- No date of birth, phone number or location is collected.
- The password-reset email and code were kept in permanent browser storage; now per-tab session storage.
- No requests to Google Fonts or Google's favicon service (fonts self-hosted; link previews show a neutral icon).
- Still present: unused counters from an older version on the user table (`postCount`, `followerCount`, …).
  They hold no personal data but could be dropped.

### Third parties (item 8)

| Service | What it sees | Controls |
|---|---|---|
| Google reCAPTCHA | IP, browser details, sets cookies (sign-up page only) | Loads only after consent |
| Metered (call relay/TURN) | IP addresses, encrypted call traffic | Listed in the Privacy Policy. **Its username/password are hard-coded in the web bundle**, so anyone can use your relay. Replace with short-lived credentials from your backend |
| Brevo | Email addresses and email content | Listed |
| Render, Neon, Cloudflare (Pages, R2) | Hosting, database, files | Listed |
| Expo | Push notification delivery (mobile) | Listed |

`npm audit` on production dependencies: the critical and high findings are in Create React App's build
toolchain (not shipped to browsers). `react-router-dom` was upgraded to the latest 6.x; two remaining
advisories apply only to server-side rendering or to navigating to untrusted URLs, which the open-redirect fix below removes.
Moving off Create React App (for example to Vite) would clear the rest.

### Dark patterns (item 9)

Checked and fine: no pre-ticked boxes; Reject is as easy as Accept; no countdown timers, fake scarcity or
confirm-shaming; account deletion takes the same effort as signing up; the guest "you need an account" prompt only
appears after the person tries something that needs one. One judgement call: encryption set-up is mandatory,
because the server now refuses unencrypted messages. It always offers "Log out".

## The four risks, and what else was found

| Risk | Fix |
|---|---|
| Keys in browser storage (XSS) | Strict Content-Security-Policy (`public/_headers`); no inline scripts; the only raw-HTML sink removed; keys encrypted at rest under a non-extractable browser key. An XSS bug could still use the keys while the page runs, which is why the CSP matters most |
| Server sees metadata | Reduced: IPs minimised, call logs 30 days, key history 30 days. Who talks to whom and when is inherent to routing messages |
| CSRF with `SameSite=None` cookie | The cookie endpoints (`/users/session`, `/users/logout`) now check the `Origin`/`Referer` against your allowed sites |
| 7-day access token | Default is 1 hour (`JWT_EXPIRATION_MS`). The web app renews it silently (on a timer and on a 401) from the remember-me cookie |
| **Found:** `GET /messages/{a}/{b}` was public | Anyone could read any conversation's stored data. Now requires login and being one of the two people |
| **Found:** group messages and group lists | Any logged-in user could read any group's messages and anyone's group list. Now members only / your own |
| **Found:** open redirect in sign-in (`?next=`) | Only paths inside the app are allowed |
| **Found:** account deletion | Wasn't a real erasure; now is |

## Mobile app impact (backend changes it must follow)

- Registration must send `tosAccepted: true` and `ageConfirmed: true`.
- Access tokens last 1 hour: the app must renew them (`POST /users/session` with the cookie) or you set `JWT_EXPIRATION_MS`.
- `GET /messages/{a}/{b}` needs `Authorization`.
- Messages must be encrypted (earlier change), and markup/trim features that need plaintext media are rejected.

# Sending email from your own domain (Cloudflare)

Skepticall sends two kinds of email you need to work: the **sign-up verification code** and the **password-reset code**
(plus an optional "new sign-in" alert and the account-deletion confirmation link). They all go through one place,
`EmailService`, which can use any SMTP server. This guide uses Cloudflare Email Service, so the mail comes from
`no-reply@yourdomain.com` and shows your domain, not a provider's.

> Cloudflare Email Service sending is in **beta**, and sending to any recipient needs a paid Workers plan (check the
> current pricing and limits in the Cloudflare dashboard before you rely on it). If that doesn't suit you, any other SMTP
> provider works the same way: see the last section.

## How the flows work

| Flow | What happens |
|---|---|
| Sign-up | Page asks for a code → server emails a 6-digit code (valid 10 minutes, 5 wrong guesses allowed, one new code per minute per address) → person enters it → they have 30 minutes to finish creating the account. **The server refuses to create an account without a verified code**, so the check can't be skipped by calling the API directly |
| Forgot password | Email entered → a code is sent **only if an account exists** (the page answers the same either way) → code + new password → reset |
| Sign-in alert (optional) | Sent only if the person turned it on; has a one-click "turn off" link |

## Set it up

1. **Onboard your domain for sending.** Cloudflare dashboard → **Compute → Email Service → Email Sending → Onboard Domain**,
   choose your domain, then **Add records and onboard**. Cloudflare adds the DNS records for you (MX for bounces, SPF, DKIM
   and DMARC on a `cf-bounce.` subdomain / `_dmarc`). Your domain must already use Cloudflare DNS.
2. **Create an API token** with the **Email Sending: Edit** permission (My Profile → API Tokens → Create Token). Copy it once: it
   is your SMTP password. Treat it like a password.
3. **Set the backend environment variables** (Render, and your IntelliJ run configuration):

   ```
   MAIL_PROVIDER=smtp
   MAIL_FROM_EMAIL=no-reply@yourdomain.com      # must be on the domain you onboarded
   MAIL_FROM_NAME=Skepticall
   SPRING_MAIL_HOST=smtp.mx.cloudflare.net
   SPRING_MAIL_PORT=465
   SPRING_MAIL_PROTOCOL=smtps
   SPRING_MAIL_USERNAME=api_token               # literally this word
   SPRING_MAIL_PASSWORD=<your API token>
   FRONTEND_URL=https://yourapp.pages.dev       # used for links inside emails
   ```

   Port 465 with implicit TLS is the only SMTP mode Cloudflare accepts (no STARTTLS on 587).
4. **Redeploy**, then sign up with a Gmail address you own. In Gmail open the message → ⋮ → **Show original** and check that
   **SPF, DKIM and DMARC all say PASS**. If they do, the message shows your domain and no "via ..." label.
5. **A contact address people can write to** (`privacy@yourdomain.com`): Cloudflare dashboard → **Compute → Email Service →
   Email Routing** → create a rule that forwards it to your real inbox (free; receiving only). Use it as
   `LEGAL_CONTACT_EMAIL` (backend) and `REACT_APP_CONTACT_EMAIL` (web).
6. In the web env set `REACT_APP_EMAIL_PROVIDER=Cloudflare` if you want the Privacy Policy to name the provider.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend log: `[email] MAIL_PROVIDER=smtp but no SMTP server is configured` | `SPRING_MAIL_HOST` isn't set |
| Log: `[email] no From address configured` | `MAIL_FROM_EMAIL` is empty |
| `Failed to send email for verification code: ...` in the sign-up form | Read the rest of the message: `535` = wrong username/token (the username must be `api_token`); a rejected sender = the From domain isn't onboarded on the account that owns the token; a connection timeout = port 587 / STARTTLS was used instead of 465 + `smtps` |
| Mail goes to spam | A brand-new domain has no reputation yet. Keep the DMARC record, don't send bulk mail, and ask your first test recipients to mark it "not spam" |
| "Please wait a minute before asking for another code" | By design (flood protection) |
| Local development | Set `REQUIRE_EMAIL_VERIFICATION=false` and `MAIL_PROVIDER=smtp` with a local mail catcher such as MailHog (host `localhost`, port 1025, `SPRING_MAIL_PROTOCOL=smtp`) |

## Using another provider instead

Set `MAIL_PROVIDER=smtp`, `MAIL_FROM_EMAIL`, and the `SPRING_MAIL_*` values from the provider's dashboard (usually port 587 with
`SPRING_MAIL_PROTOCOL=smtp`). Whatever provider you pick, verify your domain with it (SPF + DKIM + DMARC); that is what removes the
provider's name from the message. Brevo still works too: `MAIL_PROVIDER=brevo` plus `BREVO_API_KEY`.

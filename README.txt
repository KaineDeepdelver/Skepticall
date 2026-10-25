Copy "frontend" over your project's frontend folder (same paths), then DELETE:
  frontend/src/pages/auth/VerifySignUp.js     (unused; verification is now inside SignUp.js)

  cd frontend && npm run build

No new dependencies. No backend changes needed.

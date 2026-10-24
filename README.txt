Copy "frontend" over your project's frontend folder (same paths), then DELETE:
  frontend/src/pages/auth/VerifySignUp.js     (unused; verification is now inside SignUp.js)

  cd frontend && npm run build

No new dependencies. No backend changes needed.

New this round: Settings -> Security -> "Message backup" (Download messages / Open backup)
  src/backup/exportMessages.js, openMessageBackup.js, MessageBackupPanel.js,
  BackupViewer.js, messageBackup.css, exportMessages.test.js

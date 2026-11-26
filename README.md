# NexHealth v0.6 Cloud Edition (development)

Uses Neon PostgreSQL and a single Render web service serving both React and API, avoiding cross-site session cookies. Existing v0.5 business logic is retained. Database stores the existing application state as a JSONB document with transactional row locking; normalized tables are future work.

1. Create a Neon project and copy its pooled connection string with sslmode=require.
2. Push this folder to a private GitHub repository (never commit .env or data).
3. In Render create a Node Web Service from the repository. Root directory blank. Build: `npm install --include=dev && npm run build`. Start: `npm run server`. Health check: `/health`. Or use render.yaml as a Blueprint.
4. Set NODE_ENV=production, DATABASE_URL (Neon URL), ADMIN_PASSWORD (at least 12 characters), OPENAI_API_KEY (optional), APP_URL (exact Render HTTPS origin, no trailing slash; defaults to RENDER_EXTERNAL_URL). Do not set PORT manually on Render.
5. Deploy and open the Render URL. Initial admin: admin@nexhealth.local. Password only seeds an empty database.
6. For local use copy .env.example to .env, configure DATABASE_URL, npm install, npm run server, then npm run dev in another terminal.

Existing SQLite records are NOT automatically imported. Keep your old database backup. For a new empty Neon database only, the optional import script can be run locally before the first backend startup. It imports the legacy state and clears sessions. Do not use real patient data until security and POPIA review. Free Render services may sleep; continuous monitoring needs an always-on service.

Verification: five existing business-logic tests pass; live Neon, Render deployment and frontend build are not verified. No lockfile is included.

## v0.7 consultations
Upgrade source files in the existing repository; retain Render environment variables and Neon database. Back up the database first. New consultation records are added lazily to the existing JSONB state; no destructive migration. Verified practice accounts have a Consultations menu. Schedule, record notes, record consent attestations and close appointments. No video service, clinical AI, legal consent validation or prescribing is included. Practice account is the current access boundary, not individual clinician credentials. Use fictional data only.

TypeScript config now includes DOM.Iterable for FormData iteration. Run `npm install`, `npm test`, `npm run typecheck`, `npm run build`. If type checking still fails, report exact errors; existing development workaround is `npm install --include=dev && npx vite build` on Render. Keep `npm run server` as start command. Live Neon and frontend compilation have not been verified for this release.

## v0.7.1 clinical scribe prototype
Use fictional data only. Set RECORDING_KEY to a persistent random 32-byte hex key (generate locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`). Keep it secret and backed up; losing it makes audio unreadable. Set CLINICAL_AI_ENABLED=true only for approved synthetic testing, and configure OPENAI_API_KEY. Existing Render build/start commands remain unchanged. Start a consultation, attest explicit audio-recording-and-ai consent, record microphone audio, stop, then save and generate draft. Audio is encrypted with AES-256-GCM in a separate PostgreSQL table; transcript and draft remain in existing practice-private state. Max upload 20 MiB. Processing is synchronous; no live transcription, video capture, speaker separation, retention/deletion workflow or automatic diagnosis approval. Failed AI processing does not save audio; retry while the page remains open. Enter reviewed assessment and plan manually before completion. ICD-10 lookup uses supplied July 2014 reference, not current validated codes. No real patient data until clinical, privacy, retention, security and provider-processing review is complete.

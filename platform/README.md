# Vocab Platform (local-first prototype)

A practice site where many teachers make word decks in any language, share them with a **4-character code**, and students practice **words, reading, listening and writing**. Everything runs on your own computer: a SQLite file and a local folder. No cloud account needed.

The Korean app in the repository root is not touched. This is a separate app in `platform/`.

## Run it

You need **Node.js 22 or newer** (`node -v`).

```bash
cd platform
npm install
npm run seed      # sample decks and accounts (safe to run again)
npm run dev       # API on :8787 + website on :5173
```

Open **http://localhost:5173**.

| Sample | |
|---|---|
| Accounts | `demo` / `demo1234` (admin), `ravi` / `ravi1234` |
| Decks | `KR24` Korean (Hindi + English), `ES25` Spanish (strict writing), `HN26` Hindi (hints off), `JP27` Japanese (by ravi) |
| Creator pages | http://localhost:5173/@demo, http://ravi.localhost:5173 |

Other commands:

```bash
npm test          # all tests (Vitest)
npm run reset     # delete the local database and uploads (.data/)
npm run build && npm start   # one process on http://localhost:8787, like production
```

If `npm install` fails on `better-sqlite3`, install build tools once: `sudo apt install build-essential python3`, then run `npm install` again.

## Try the whole flow (about 5 minutes)

1. **Create a deck.** Sign in (or create an account) → **Studio** → **New deck** → pick languages → **Fill a sample** → **Create deck and get a code**. You see a code like `YPRG`.
2. **Teacher rules.** Open the **Rules** tab. Turn Listening off, set Writing to *Strict typing*, choose *Show options at once*. **Save rules**. Items you changed get a “changed” tag.
3. **Branding.** **Branding** tab: title, note, badge, color, logo. Save, then open the deck: the top bar uses them.
4. **Practice as a student.** Open a private window (so you are a guest), go to `http://localhost:5173/YPRG` (your code). Try each mode:
   - **Words:** new words are shown first; then think of the meaning, press *I know it*, pick. Sometimes the answer is missing: pick *Not in the list*.
   - **Reading:** read the word, tap for the reading hint, reveal the meaning. Repeats show the example sentence.
   - **Listening:** word, pause, sentence. Use the speed and pause sliders. On a device without a voice for the language you see the reading aid instead.
   - **Writing:** type the word or tap the letter tiles (Guided), or type it exactly (Strict).
   At the end: the missed-word drill, a summary and a next-step suggestion.
5. **Report.** On a deck page press **⚑ Report this deck** (works as a guest). Three reports from different people flag a deck.
6. **Moderate.** Sign in as `demo` → **Reports** → Keep / Mark under review / Hide. A hidden deck's code says “not found”.
7. **Read the manual** at http://localhost:5173/docs.

## Folder layout

```
platform/
  drizzle/                    SQL migrations (applied automatically on start)
  src/
    core/                     pure logic, no database or browser APIs
      code.ts                 4-character codes: alphabet, normalize, unique generation
      rules.ts                default rules, teacher overrides, validation
      tenant.ts               creator slugs, /@slug and slug.localhost routing
      script/                 how each writing system compares answers and makes tiles
      quiz/                   wrong-option picking, "Not in the list", grading (from the Korean app's PR #2)
      session.ts              one practice session: order, repetitions, missed drill, summary
      srs.ts                  FSRS spaced repetition (ts-fsrs) as plain JSON
      cardText.ts             "term | meaning | ..." word lists
      types.ts                Deck, Card, Creator, User, Report ...
    server/
      ports.ts                the interfaces (swap points)
      container.ts            the one file that picks adapters
      adapters/sqlite/        schema.ts (Drizzle), db.ts, stores.ts
      adapters/local.ts       local media folder, mock Google
      services/               auth, decks, moderation, progress
      http/app.ts             Hono routes (/api/*, /media/*)
      seed.ts, reset.ts
    web/                      React website (Vite + Tailwind)
      pages/                  Home, Deck, Practice, Creator, Login, Studio, NewDeck, EditDeck, Admin, Docs
      practice/               the four rounds, speech, shared parts
  .data/                      created on first run: vocab.db + media/ (git-ignored)
```

## Interfaces for scaling later

Services and routes only use these (in `src/server/ports.ts`). Each has a local version today:

| Interface | Local version | Production idea |
|---|---|---|
| `DeckStore`, `CreatorStore`, `UserStore`, `ProgressStore`, `ReportStore` | SQLite via Drizzle | Postgres / Supabase |
| `MediaStore` | files in `.data/media` | S3, Cloudflare R2, Supabase Storage |
| `AuthService` | guests, scrypt passwords, sessions in SQLite | same service on Postgres, or a hosted auth |
| `GoogleProvider` | pretend Google page | real Google OAuth (a new adapter, then `GOOGLE_PROVIDER=google`) |
| `ModerationService` | report counts → flagged / hidden | same, plus admin tools |
| `RateLimiter` | SQLite sliding window | Redis when there is more than one server |

To switch, write the new adapter and change `src/server/container.ts`. Nothing in `core/`, `services/`, `http/` or `web/` changes.

Every deck row has `creator_id`, `code` (unique), `source_lang`, `target_lang`, `alt_lang`, `script_meta`, `ruleset` (only the changed rules), `branding`, `visibility` and `moderation_status`. Ids are UUIDs.

## Settings

All optional. Copy `.env.example` to `.env` to change them: `DATA_DIR`, `API_PORT`, `WEB_PORT`, `BASE_DOMAIN`, `GOOGLE_PROVIDER`.

## Not done yet (next steps)

- Real Google OAuth provider (the routes, state check and account linking are in place)
- Postgres/Supabase adapters for the stores
- Admin view of already hidden decks (today the owner sees them in Studio)
- Custom domains for creators (subdomains work)

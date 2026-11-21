import { Link } from 'react-router-dom';
import { CODE_ALPHABET, CODE_SPACE } from '../../core/code';
import { DEFAULT_RULES } from '../../core/rules';

const SECTIONS = [
  ['codes', 'The 4-character code'],
  ['students', 'For students'],
  ['creators', 'For teachers and creators'],
  ['rules', 'Defaults and teacher rules'],
  ['modes', 'Reading, Listening and Writing'],
  ['accounts', 'Accounts and sign-in'],
  ['safety', 'Reports and moderation'],
  ['data', 'How data is stored'],
  ['scaling', 'Going to production'],
] as const;

export function DocsPage() {
  const r = DEFAULT_RULES;
  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
      <nav className="top-20 hidden self-start text-sm lg:sticky lg:block">
        <div className="mb-2 font-semibold">Manual</div>
        <ul className="space-y-1">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-slate-600 hover:text-slate-900">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="prose-doc max-w-3xl">
        <h1 className="text-3xl font-bold">Manual</h1>
        <p className="mt-2">
          This is a local prototype of a vocabulary and skills practice site for many teachers and many languages. Everything runs on your own computer: the database is one file and uploads go in one folder. No cloud account is needed.
        </p>

        <h2 id="codes">The 4-character code</h2>
        <p>
          Every deck gets its own code, such as <code>A7K9</code>. The code is the whole share link: a student types it on the home page, or opens <code>{location.origin}/A7K9</code>.
        </p>
        <ul>
          <li>
            Codes use only <code>{CODE_ALPHABET}</code>. There is no 0, O, 1, I or L, so a code read aloud in a video or copied from a screenshot is never mixed up.
          </li>
          <li>That gives {CODE_SPACE.toLocaleString()} possible codes. Codes that spell rude words are skipped.</li>
          <li>Upper or lower case both work (a7k9 = A7K9). Spaces and dashes are ignored.</li>
          <li>A code is picked at random when the deck is made and checked against every existing deck. The database also has a unique rule on the code, so two decks can never share one, even if they are made at the same moment.</li>
          <li>The code never changes when you edit the deck, so links in old videos keep working.</li>
        </ul>

        <h2 id="students">For students</h2>
        <ol>
          <li>Type the code on the home page (or open the link). No sign-up.</li>
          <li>Pick a mode: Words, Reading, Listening or Writing (the teacher decides which are on).</li>
          <li>Each session has up to {r.wordsPerSession} words: words due for review first, then new ones. Each word must be answered right {r.targetReps} times.</li>
          <li>
            Progress is saved for you as a guest in this browser. To keep it on other devices, <Link to="/login">create an account</Link>: your guest progress moves into it.
          </li>
        </ol>
        <p>Keyboard: Space or Enter to continue, 1 to 4 to pick an option, 5 for “Not in the list”, X for “I don't know”, J to play the sound again, H for a reading hint.</p>

        <h2 id="creators">For teachers and creators</h2>
        <ol>
          <li>
            <Link to="/login">Create an account</Link> (username and password, or Google). You get a creator page at <code>/@yourname</code>, and also <code>yourname.localhost:5173</code>.
          </li>
          <li>
            In <Link to="/studio">Studio</Link>, press <b>New deck</b>, choose the languages and paste your words, one per line:
            <pre>
              <code>{'term | meaning | reading | example | example translation | meaning 2 | writing prompt\n물 | पानी | mul | 물 좀 주세요. | थोड़ा पानी दीजिए। | water'}</code>
            </pre>
            Only the first two columns are needed. Copying from a spreadsheet works too (tabs instead of |).
          </li>
          <li>You get the code right away. Share it in your video or class.</li>
          <li>Open the deck to change rules, branding (logo, title, note, badge, color), words and settings. Learners get the changes on their next session.</li>
        </ol>
        <p>Editing words keeps learner progress for every word whose term you did not change. You can also upload your own recording for a word.</p>

        <h2 id="rules">Defaults and teacher rules</h2>
        <p>Every deck starts with beginner-friendly defaults. A deck stores only the rules its teacher changed, so if a default gets better later, decks that never touched it get the improvement too.</p>
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Default</th>
              <th>What a teacher can do</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Practice modes</td>
              <td>All four on</td>
              <td>Turn any of them off (at least one stays on)</td>
            </tr>
            <tr>
              <td>Words per session</td>
              <td>{r.wordsPerSession}</td>
              <td>3 to 50</td>
            </tr>
            <tr>
              <td>Right answers per word (target repetitions)</td>
              <td>{r.targetReps}</td>
              <td>1 to 5</td>
            </tr>
            <tr>
              <td>How questions start</td>
              <td>Recall first: think of the meaning, press “I know it”, then pick</td>
              <td>Show options at once</td>
            </tr>
            <tr>
              <td>“Not in the list”</td>
              <td>On: about 1 question in 5 leaves the answer out (never on a word's very first test)</td>
              <td>Turn off</td>
            </tr>
            <tr>
              <td>Show new words first</td>
              <td>On (a “New word” card before the first test)</td>
              <td>Turn off</td>
            </tr>
            <tr>
              <td>End of session</td>
              <td>Drill missed words, show a summary, suggest a next step</td>
              <td>Turn each one off</td>
            </tr>
            <tr>
              <td>Reading hint</td>
              <td>One tap away</td>
              <td>Always show, or hide completely</td>
            </tr>
            <tr>
              <td>Listening</td>
              <td>
                Speed {r.listening.speed}×, {r.listening.gapSeconds}s pause, then an example sentence; reading aid when no voice
              </td>
              <td>Change speed and pause, turn sentences or the text fallback off</td>
            </tr>
            <tr>
              <td>Writing</td>
              <td>Guided: type or tap letter tiles, one-letter slips count, accents optional</td>
              <td>Self-check on paper, or strict typing; add your own writing prompts</td>
            </tr>
          </tbody>
        </table>
        <p>Wrong options are chosen to be hard to rule out: words the learner already studied, the same part of speech and topic, and words that look alike. Never a true synonym. Options a word showed recently are not reused right away.</p>

        <h2 id="modes">Reading, Listening and Writing</h2>
        <h3>📖 Reading</h3>
        <p>
          The learner reads a word (first time) or its example sentence (repeats), then reveals the meaning and says if they got it. The reading aid (romanization, pinyin, romaji, transliteration) is one tap away by default, so beginners are never stuck. Teachers can show it always or hide it. Using the hint still counts, but the word comes back a little sooner.
        </p>
        <h3>🎧 Listening</h3>
        <p>
          The word plays, then a pause, then an example sentence, and the learner picks the meaning. Sliders change speed and pause length (remembered on that device). Sound comes from the teacher's recording if there is one, otherwise from the device's voice for that language. If the device has no voice for the language, the page says so and shows the reading aid instead, so the round still works.
        </p>
        <h3>✍️ Writing</h3>
        <ul>
          <li>
            <b>Guided (default):</b> type the word, or tap letter tiles (the word's own letters or syllables plus a few extra). Nobody needs a special keyboard. A one-letter slip counts as “almost”; accents are optional.
          </li>
          <li>
            <b>Strict:</b> type it exactly, accents and all. No tiles.
          </li>
          <li>
            <b>Self-check:</b> write on paper, then compare.
          </li>
          <li>
            <b>Writing prompts:</b> add a 7th column to a word, like “Write a sentence about your friend”. On the word's repeat, the learner writes freely and compares with the example.
          </li>
        </ul>
        <p>Only writing (producing the word) can push a word's next review beyond 7 days. Recognising it (words, reading, listening) keeps reviews within a week.</p>

        <h2 id="accounts">Accounts and sign-in</h2>
        <ul>
          <li>
            <b>Guest:</b> made automatically the first time someone practices. Stored as a normal user marked “guest”.
          </li>
          <li>
            <b>Username and password:</b> passwords are hashed with scrypt and a random salt. Sessions are random tokens in an httpOnly cookie; only a hash of the token is stored.
          </li>
          <li>
            <b>Google:</b> locally this opens a pretend Google page where you type any name and email. The real Google sign-in plugs into the same place (see below).
          </li>
        </ul>

        <h2 id="safety">Reports and moderation</h2>
        <ul>
          <li>Every deck and word has a ⚑ Report link. Guests can report too.</li>
          <li>Each deck or word has a status: <b>active</b>, <b>flagged</b> (still usable, shows “under review”) or <b>hidden</b> (the code says “not found”).</li>
          <li>Reports from 3 different people flag it automatically; 10 hide it. An admin decides in the Reports page, which closes the reports.</li>
          <li>Rate limits: 10 new decks per hour per account and per network address, 20 reports per hour, plus limits on sign-up, sign-in and uploads.</li>
          <li>Uploads accept only images (2 MB) and audio (5 MB) of known types.</li>
        </ul>

        <h2 id="data">How data is stored</h2>
        <p>
          Everything lives in the <code>platform/.data</code> folder: <code>vocab.db</code> (SQLite) and <code>media/</code> (uploads). Delete the folder, or run <code>npm run reset</code>, to start fresh.
        </p>
        <table>
          <thead>
            <tr>
              <th>Table</th>
              <th>What it holds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>users, sessions</td>
              <td>Guests and members, password hashes, session token hashes</td>
            </tr>
            <tr>
              <td>creators</td>
              <td>One per teacher: slug (for /@slug and subdomains), name, branding, status</td>
            </tr>
            <tr>
              <td>decks</td>
              <td>creator_id, unique code, target and source language, script_meta, ruleset (only changed rules), branding, visibility, moderation_status</td>
            </tr>
            <tr>
              <td>cards</td>
              <td>term, reading, meaning, second meaning, examples, audio, writing prompt, moderation_status</td>
            </tr>
            <tr>
              <td>progress</td>
              <td>Spaced-repetition memory (FSRS) per learner, word and skill</td>
            </tr>
            <tr>
              <td>attempts</td>
              <td>Every answer: skill, outcome, grade, time</td>
            </tr>
            <tr>
              <td>reports, rate_events, media</td>
              <td>Moderation reports, rate-limit counters, uploaded file records</td>
            </tr>
          </tbody>
        </table>
        <p>
          Any language works because nothing is tied to Korean: a deck says which language it teaches and how that language is written (<code>script_meta</code>: script code like Hang, Latn, Deva or Jpan, left-to-right or right-to-left, and what the reading aid is called). The script decides how typed answers are compared and how letter tiles are cut.
        </p>

        <h2 id="scaling">Going to production</h2>
        <p>The code is split so storage can move to the cloud without touching the learning logic:</p>
        <pre>
          <code>{`src/core/      pure logic: codes, rules, quiz, sessions, scripts (no database)
src/server/ports.ts      the swap points (interfaces)
  DeckStore  CreatorStore  UserStore  ProgressStore  ReportStore
  AuthService  MediaStore  ModerationService  RateLimiter  GoogleProvider
src/server/adapters/     today's local versions: SQLite, local folder, mock Google
src/server/container.ts  the one file that picks which adapter to use`}</code>
        </pre>
        <ul>
          <li>
            <b>Database:</b> write Postgres (for example Supabase) versions of the stores. The schema already uses UUIDs, creator_id on every tenant row and JSON columns, so it maps one to one.
          </li>
          <li>
            <b>Files:</b> a <code>MediaStore</code> for S3, Cloudflare R2 or Supabase Storage (put, get, remove).
          </li>
          <li>
            <b>Google:</b> a <code>GoogleProvider</code> that redirects to Google and checks the returned token. The routes and the account linking are already there.
          </li>
          <li>
            <b>Subdomains:</b> set <code>BASE_DOMAIN</code> to your domain and add a wildcard DNS record (<code>*.yourdomain.com</code>). The server already reads the creator from the host name. Custom domains need one extra lookup table.
          </li>
          <li>
            <b>Rate limits:</b> move <code>RateLimiter</code> to Redis or the database when running more than one server.
          </li>
        </ul>
      </article>
    </div>
  );
}

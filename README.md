# Vocab Korean

<p align="center">
Learn Korean vocabulary with active recall and spaced repetition, with Hindi and English meanings.
</p>

<p align="center">
  <a href="https://github.com/hariom-jbnu/Vocab-korean">Repository</a>
  •
  <a href="https://vocab.free.nf/?i=1">Live Demo</a>
</p>

---

## Overview

Vocab Korean helps you remember Korean words, not just read them. Each word is shown in Korean first and you answer a short question about it: pick the meaning, pick it by ear, or type the word in Hangul. The app grades the answer itself, and a spaced repetition scheduler (FSRS) brings every word back just before you would forget it.

The platform focuses on:
- Active recall instead of re-reading
- Spaced repetition with the FSRS algorithm
- Hindi and English meanings for every word
- Progress saved in your browser, no account needed
- Fast, distraction-free study on desktop and mobile

Built for:
- Korean language learners, especially Hindi speakers
- Students preparing for TOPIK
- Daily vocabulary practice

---

## Features

- **Daily review**: due words first, then a few new words a day in shuffled order
- **Quiz rounds that get harder as you learn**: multiple choice for new words, a listening round once a word sticks, and typing in Hangul for words you know well
- **Automatic grading** from correctness and answer time, so there is nothing to self-rate
- **Hangul feedback**: typed answers are checked letter by letter and a one-letter slip counts as a near miss
- **Flip cards** with Again / Hard / Good / Easy buttons, if you prefer rating yourself
- **FSRS scheduling** through [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs), tuned by a single "target recall" setting
- **Stats**: words known, recall over the last 30 days, word stages, a 14-day review forecast and your hardest words
- **Daily goal and streak**, with one missed day a week forgiven
- **Saved progress**: cards and the full review history are stored in IndexedDB
- **Backup and restore** your progress as a file, or reset it
- **Works offline** and can be installed to the home screen
- **Undo** the last answer
- **Browse mode**: flip through all 1,670 words in order or at random
- **Text-to-speech** in Korean with voice, speed and pitch controls
- **Themes and card colors**, remembered between visits

### Keyboard shortcuts

| Key | Action |
|---|---|
| `1` `2` `3` `4` | Pick a choice in the quiz, or Again / Hard / Good / Easy on flip cards |
| `Space` / `Enter` | Continue after a quiz answer; on flip cards, show answer then rate Good |
| `R` | Play audio |
| `U` | Undo last answer |
| `←` `→` | Previous / next card in Browse |

---

## How it works

1. Every word starts as **new**. You see up to *N* new words a day (10 by default).
2. After each answer, FSRS updates the word's **stability** and **difficulty** and picks the next review date so that your chance of remembering it is about your target recall (90% by default).
3. The question gets harder as a word gets more stable: multiple choice at first, listening from about 3 days, typing from about 3 weeks.
4. Answers are graded automatically. A wrong answer is "Again", a slow or nearly right one is "Hard", a quick typed answer is "Easy".
5. Words you miss come back within the same session; words you know well come back days or months later.
6. Every answer is kept in an append-only log, so the schedule can be re-tuned later without losing progress.
7. A study day rolls over at 4 a.m., so a late-night session still counts for that day.

---

## Preview

| Home Page | Settings Page |
|---|---|
| ![](data/asset/home.png) | ![](data/asset/setting.png) |

---

## Tech Stack

### Frontend
- **React 19** with **TypeScript**
- **Vite** for development and builds
- **Tailwind CSS 4** via `@tailwindcss/vite`
- **React Router** (hash routing, works on any static host)

### Learning engine
- **ts-fsrs**: FSRS-6 spaced repetition scheduler
- **IndexedDB** (via `idb`): cards and review history
- **localStorage**: settings

### Browser APIs
- **Web Speech API**: Korean text-to-speech
- **Service worker** and web app manifest: offline use and install

### Testing
- **Vitest** with `fake-indexeddb`

---

## Project Structure

```bash
Vocab-korean/
├── data/
│   ├── ko_hi_en_vocab.csv   # Word list: Korean, Hindi, English
│   └── asset/               # README screenshots
├── public/                  # Manifest and app icons
├── src/
│   ├── components/          # Quiz rounds, settings panel, footer
│   ├── hooks/               # Review session, daily progress, speech
│   ├── lib/                 # FSRS wrapper, queue, quiz grading, Hangul, stats
│   ├── pages/               # Review, Stats, Browse, Contact
│   ├── sw.js                # Service worker template
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

---

## Quick Start

### Prerequisites

* Node.js 20+
* npm

### Installation

```bash
# Clone repository
git clone https://github.com/hariom-jbnu/Vocab-korean.git

# Enter project directory
cd Vocab-korean

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

Application runs at:

```bash
http://localhost:3000
```

---

## Production Build

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

---

## Development Goals

* Improve Korean vocabulary retention
* Build distraction-free learning workflows
* Provide scalable vocabulary study tools
* Integrate AI-assisted language learning
* Support modern web performance standards

---

## Roadmap

* Example sentences and cloze cards
* Topic and TOPIK level tags for focused study
* Reverse cards (meaning to Korean)
* Tune FSRS to each learner's own review history
* Optional cloud sync

---

## Contributing

Contributions are welcome.

```bash
# Create feature branch
git checkout -b feature/your-feature

# Commit changes
git commit -m "feat: add new feature"

# Push branch
git push origin feature/your-feature
```

Open a Pull Request describing your changes.

---

## Security Notes

* Never commit `.env` files
* Store secrets in `.env.local`
* Review dependencies regularly
* Validate external API inputs

---

## Support

* Report bugs via GitHub Issues
* Submit feature requests
* Share improvements through Pull Requests

Repository:

* [https://github.com/hariom-jbnu/Vocab-korean](https://github.com/hariom-jbnu/Vocab-korean)

---

## License

This project is licensed under the LICENSE file.

---

## Author
Built by [Hariom Dhakad](https://github.com/py-hariom) & [Hariom Dhakad](https://github.com/hariom-jbnu)


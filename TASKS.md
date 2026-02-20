# AI LLM IDE Milestones

## Stack & Architecture Decisions
- **Framework:** Next.js 14+ App Router, TypeScript
- **Styling:** Tailwind CSS
- **Data:** Static `stations.json` compiled offline from open data sources — no runtime database
- **Daily seed:** `seedrandom` npm package for deterministic station selection by date
- **No external API calls at runtime** — all game logic runs client-side against the local JSON
- **Environment variables:** None required (all data is bundled)

---

### Milestone 1 — Project Scaffold
**Goal:** A running Next.js app with the correct dependencies.

- Run: `npx create-next-app@latest traindle --typescript --tailwind --app --no-src-dir --import-alias "@/*"`
- Install: `npm install seedrandom` and `npm install --save-dev @types/seedrandom`
- **Acceptance criteria:** `npm run dev` serves the default Next.js page at `localhost:3000` with no TypeScript or build errors

---

### Milestone 2 — Station Data Compilation
**Goal:** A single `stations.json` file containing all fields needed by the game.

- Download the `stations.json` from [davwheat/uk-railway-stations](https://github.com/davwheat/uk-railway-stations) — this provides `name`, `crs`, `lat`, `lon`, `operator`
- Download the ORR "Estimates of Station Usage" CSV from [dataportal.orr.gov.uk](https://dataportal.orr.gov.uk/statistics/usage/estimates-of-station-usage)
- Write a one-off Node.js script (`scripts/compile-stations.ts`) that:
  - Loads both files, joins them on CRS code
  - Assigns each station to a UK region based on the `lat`/`lon` (use a simple bounding-box lookup per region)
  - Assigns a `stationType` field: `'terminus'` if only one set of services, `'interchange'` if 3+ operators, otherwise `'through'`
  - Assigns a `footfallBand` field: `'<100k'` / `'100k-1m'` / `'1m-10m'` / `'10m+'`
  - Outputs `public/stations.json` with fields: `name`, `crs`, `operator`, `region`, `platforms`, `footfallBand`, `stationType`
- Platform count: where not available from davwheat data, default to `null` and exclude those stations from the pool
- **Acceptance criteria:** `npx ts-node scripts/compile-stations.ts` produces `public/stations.json` with at least 500 stations, each having all required fields populated (or explicitly `null`)

---

### Milestone 3 — Daily Station Seed
**Goal:** A deterministic function that returns the same mystery station for all players on a given day.

- Create `lib/getDailyStation.ts`
- Import `stations.json` and `seedrandom`
- Use today's date formatted as `YYYY-MM-DD` as the seed string
- Use the seeded RNG to pick a consistent index into the stations array
- Export `getDailyStation(): Station` and `getDailyStationIndex(): number`
- **Acceptance criteria:** Calling `getDailyStation()` multiple times on the same day always returns the same station. Changing the date string returns a different station.

---

### Milestone 4 — Guess Input with Autocomplete
**Goal:** A station name input that filters the full station list as the user types.

- Create `components/StationInput.tsx` — a controlled text input that filters `stations.json` on the client as the user types (case-insensitive, matches anywhere in the name)
- Show up to 8 suggestions in a dropdown below the input
- Selecting a suggestion fires an `onGuess(station: Station)` callback and clears the input
- Stations already guessed in the current session should be excluded from suggestions
- **Acceptance criteria:** Typing "Man" into the input shows Manchester Piccadilly, Manchester Victoria, and other Manchester stations. Selecting one clears the input and fires the callback.

---

### Milestone 5 — Guess Evaluation Logic
**Goal:** A pure function that compares a guessed station to the mystery station and returns category feedback.

- Create `lib/evaluateGuess.ts`
- Export `evaluateGuess(guess: Station, mystery: Station): GuessResult`
- `GuessResult` is an object with one entry per category:
  - `operator`: `'correct' | 'wrong'`
  - `region`: `'correct' | 'close' | 'wrong'` — "close" uses a pre-defined adjacency map in `lib/regionAdjacency.ts`
  - `platforms`: `'correct' | 'higher' | 'lower'`
  - `footfallBand`: `'correct' | 'higher' | 'lower'` — compare band ordinal values
  - `stationType`: `'correct' | 'wrong'`
- Write unit tests for `evaluateGuess` covering all result combinations
- **Acceptance criteria:** All unit tests pass. `evaluateGuess` correctly returns `'close'` for region when two stations are in adjacent regions.

---

### Milestone 6 — Game Board UI
**Goal:** The main game page showing guesses and their category feedback.

- Build `app/page.tsx` as the main game page
- At the top, show "Traindle — Guess today's station" and the current guess count (e.g. `3 / 6`)
- Below that, render the `StationInput` component
- Below the input, render a table of previous guesses — one row per guess, five columns for each category showing coloured tiles:
  - Green for `'correct'`, orange for `'close'`, red for `'wrong'`
  - For `'higher'` show a green/red tile with a ↑ arrow; for `'lower'` show a ↓ arrow
- Column headers label each category
- When the player guesses correctly or uses all 6 guesses, hide the input and show a result message
- **Acceptance criteria:** Making guesses populates the board with correctly coloured tiles. The input disappears and a message appears when the game ends.

---

### Milestone 7 — Share & Results Modal
**Goal:** Players can share their result as an emoji grid.

- On game end, show a modal with the result (success or failure) and the mystery station name
- Include a "Share" button that copies an emoji grid to the clipboard, e.g.:
  ```
  Traindle 2025-02-20 — 3/6
  🟩🟧🟩🟧🟩
  🟩🟩🟧🟩🟩
  🟩🟩🟩🟩🟩
  ```
- Use the browser `navigator.clipboard.writeText` API; show a "Copied!" confirmation
- **Acceptance criteria:** Clicking Share copies a correctly formatted emoji grid. Each row represents a guess, each emoji represents a category result.

---

### Milestone 8 — README
**Goal:** Anyone can clone the repo and run the project with no prior context.

- Create `README.md` covering:
  - Prerequisites (Node.js 18+)
  - How to run the data compilation script to generate `public/stations.json`
  - `npm install` and `npm run dev`
  - How the daily seed works
  - Data source attributions (davwheat/uk-railway-stations ODbL, ORR open data)
- **Acceptance criteria:** A developer with no prior context can clone, compile the data, and have the game running end-to-end following only the README

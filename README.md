# Traindle

Poeltl-style daily guessing game for UK railway stations. Each day a mystery station is chosen — guess it by name or CRS code and receive colour-coded feedback across five categories.

**Live at:** https://jack-sleath.github.io/traindle/

---

## How to play

Type a station name or CRS code into the search box and select from the suggestions. Each guess reveals a row of five tiles showing how close you are across five categories. A new mystery station is chosen every day at UTC midnight, and your progress is saved automatically.

### Tile colours and icons

| Tile | Meaning |
|------|---------|
| Green ✓ | Exact match |
| Orange + arrow | Region: neighbouring (adjacent) region — arrow points toward the mystery region |
| Red + arrow | Region: non-adjacent region — arrow points toward the mystery region |
| Red ✗ | Wrong — no match (operator or station type) |
| Amber ↑ | Mystery value is **higher** (platforms or footfall) |
| Amber ↓ | Mystery value is **lower** (platforms or footfall) |

Press the **?** button in the top-right corner to show this key in-game.

### Categories (left to right)

| # | Category | What it measures |
|---|----------|-----------------|
| 1 | **Operators** | Train operators that call at the station. Green = all match, orange = partial match, red = none match |
| 2 | **Region** | Which of the 12 UK regions the station is in (see list below). Colour shows adjacent (orange) or far (red); arrow shows compass direction toward the mystery |
| 3 | **Platforms** | Number of platforms. Green = exact match; amber arrow shows which direction to go |
| 4 | **Footfall** | Annual passenger footfall band. Green = same band; amber arrow shows direction |
| 5 | **Type** | Station type: `terminus`, `through`, or `interchange`. Green or red only |

#### Regions

Scotland · Northern Ireland · Wales · North West · North East · Yorkshire · East Midlands · West Midlands · East of England · London · South East · South West

#### Footfall bands (annual entries + exits)

| Band | Annual footfall |
|------|----------------|
| `<10k` | Below 10,000 |
| `10k-100k` | 10,000 – 99,999 |
| `100k-500k` | 100,000 – 499,999 |
| `500k-1m` | 500,000 – 999,999 |
| `1m-5m` | 1,000,000 – 4,999,999 |
| `5m-10m` | 5,000,000 – 9,999,999 |
| `10m+` | 10,000,000 and above |

---

## Features

- **Daily puzzle** — the mystery station is seeded from the UTC date, so all players worldwide get the same station each day
- **Search** — type a station name or CRS code; CRS matches are ranked first in suggestions; already-guessed stations are excluded
- **Cookie persistence** — your guesses are saved in a browser cookie and restored on reload; the cookie expires at the next UTC midnight so the board clears automatically for the new day
- **Countdown timer** — shows time remaining until the next puzzle, visible in the header and in the results modal
- **Results & sharing** — on winning, a modal shows your score and an emoji grid you can copy to share
- **Other correct answers** — if other stations share identical values across all five categories, the results modal shows them in a collapsible list
- **Dark mode** — toggle between light and dark themes with the button in the top-right corner
- **Key / legend** — press **?** to open a modal explaining every tile colour and icon

### URL parameters

| Parameter | Effect |
|-----------|--------|
| `?reset` | Clears saved guesses and starts the day fresh |

---

## Running locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

The game runs entirely client-side against `public/stations.json`. No API keys or environment variables are needed.

---

## Deployment

The site deploys to GitHub Pages via GitHub Actions. Pushing to `main` triggers the workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which runs `npm run build` (producing a static `out/` folder) and publishes it.

**One-time setup** — in the GitHub repo settings go to **Settings → Pages** and set the source to **GitHub Actions**.

The build sets `basePath: /traindle` so all assets resolve correctly under `jack-sleath.github.io/traindle/`.

---

## Regenerating station data

All data generation scripts live in `scripts/`. The full pipeline is:

```
fetch_raw_stations.py     →  scripts/raw-stations.json   ─┐
scrape_stations_nrdp.py   →  scripts/uk_stations.json    ─┤→  compile-stations.ts  →  public/stations.json
generate_footfall_map.py  →  scripts/footfall-map.json   ─┘
```

**Prerequisites:** Python 3 and the `requests` library

```bash
pip install requests
```

---

### Step 0 — Fetch the base station list

Downloads station name, CRS code, coordinates and constituent country from
[davwheat/uk-railway-stations](https://github.com/davwheat/uk-railway-stations) (licensed ODbL):

```bash
python scripts/fetch_raw_stations.py
```

Writes `scripts/raw-stations.json`.

---

### Step 1 — Fetch operator and station metadata from National Rail

Register a **free** account at [opendata.nationalrail.co.uk](https://opendata.nationalrail.co.uk)
and subscribe to both:

- **Knowledgebase (KB) API** — provides platforms, station type and owning operator
- **DTD** (Darwin Timetable Data) — provides all calling train operators per station

Then run:

```bash
python scripts/scrape_stations_nrdp.py --username you@email.com --password yourpassword
```

Writes `scripts/uk_stations.json` — a map of CRS code → station record including:

- `operators` — all train operators that call at the station
- `owningOperator` — the station's managing operator
- `platforms` — number of platforms (from the Knowledgebase)
- `stationType` — `through` / `terminus` / `request` (from the Knowledgebase)

---

### Step 2 — Generate the footfall map

Downloads Table 1410 (Passenger entries, exits and interchanges by station) from the
[ORR data portal](https://dataportal.orr.gov.uk/statistics/usage/estimates-of-station-usage/)
and assigns each station a footfall band:

```bash
python scripts/generate_footfall_map.py
```

Writes `scripts/footfall-map.json` — a map of CRS code → footfall band.

Data source: ORR Table 1410 (April 2024 – March 2025).

---

### Step 3 — Compile the game data

```bash
npx ts-node --project scripts/tsconfig.json scripts/compile-stations.ts
```

Reads:

- `scripts/raw-stations.json` — base station list (name, CRS, coordinates, constituent country)
- `scripts/uk_stations.json` — operator lists, platform counts and station types from Step 1
- `scripts/footfall-map.json` — footfall bands from Step 2

Writes `public/stations.json` with all fields the game needs.

**Note:** When NRDP data is available for a station it takes precedence over heuristic estimates for platforms and station type. If data is missing, the compile script falls back to hardcoded values for major stations and name-based heuristics for the rest.

---

## Data sources

- **Base station list:** [davwheat/uk-railway-stations](https://github.com/davwheat/uk-railway-stations) (names, CRS codes, coordinates) — licensed ODbL
- **Operator / timetable data:** [National Rail Open Data Portal](https://opendata.nationalrail.co.uk) (Knowledgebase + DTD timetable feeds) — free with registration
- **Footfall data:** [Office of Rail and Road](https://dataportal.orr.gov.uk/statistics/usage/estimates-of-station-usage/) — Table 1410, Estimates of Station Usage

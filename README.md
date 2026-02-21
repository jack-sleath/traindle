# Traindle

Poeltl-style daily guessing game for UK railway stations. Each day a mystery station is chosen — guess it by station name and receive colour-coded feedback across five categories.

## Playing

Live at: https://jack-sleath.github.io/traindle/

Each guess reveals feedback for:
- **Operator** — green if all operators match, orange if some match, red if none match
- **Region** — green if same region, orange if neighbouring region, red otherwise
- **Platforms** — green if exact match, ⬆️/⬇️ indicating whether the mystery has more or fewer
- **Footfall band** — green if same band, ⬆️/⬇️ otherwise. Bands (annual entries + exits): `<10k` / `10k-100k` / `100k-500k` / `500k-1m` / `1m-5m` / `5m-10m` / `10m+`
- **Station type** — green if same (`terminus` / `through` / `interchange`), red otherwise

Six guesses to find the station. Same station for all players each day.

---

## Running locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

The game runs entirely client-side against `public/stations.json`. No API keys or environment variables are needed to run the app.

---

## Deployment

The site is deployed to GitHub Pages via GitHub Actions. Pushing to `main` triggers the workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which runs `npm run build` (producing a static `out/` folder) and publishes it.

**One-time setup** — in the GitHub repo settings, go to **Settings → Pages** and set the source to **GitHub Actions**.

The build uses `basePath: /traindle` so all assets resolve correctly under `jack-sleath.github.io/traindle/`.

---

## Regenerating station data

All data generation scripts live in `scripts/`. The full pipeline is:

```
fetch_raw_stations.py     →  scripts/raw-stations.json   ─┐
scrape_stations_nrdp.py   →  scripts/uk_stations.json    ─┤→  compile-stations.ts  →  public/stations.json
generate_footfall_map.py  →  scripts/footfall-map.json   ─┘
```

**Prerequisites:** Python 3, `requests` library

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
- **Knowledgebase (KB) API** — provides platforms, station type, owning operator
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

Writes `scripts/footfall-map.json` — a map of CRS code → footfall band. Bands are based
on annual entries + exits:

| Band | Annual footfall |
|------|----------------|
| `<10k` | Below 10,000 |
| `10k-100k` | 10,000 – 99,999 |
| `100k-500k` | 100,000 – 499,999 |
| `500k-1m` | 500,000 – 999,999 |
| `1m-5m` | 1,000,000 – 4,999,999 |
| `5m-10m` | 5,000,000 – 9,999,999 |
| `10m+` | 10,000,000 and above |

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

**Note:** When NRDP data is available for a station, it takes precedence over heuristic
estimates for platforms and station type. If data is missing, the compile script falls back
to hardcoded values for major stations and name-based heuristics for the rest.

---

## Data sources

- **Base station list:** [davwheat/uk-railway-stations](https://github.com/davwheat/uk-railway-stations) (names, CRS codes, coordinates) — licensed ODbL
- **Operator / timetable data:** [National Rail Open Data Portal](https://opendata.nationalrail.co.uk) (Knowledgebase + DTD timetable feeds) — free with registration
- **Footfall data:** [Office of Rail and Road](https://dataportal.orr.gov.uk/statistics/usage/estimates-of-station-usage/) — Table 1410, Estimates of Station Usage

# Traindle

Poeltl-style daily guessing game for UK railway stations. Each day a mystery station is chosen — guess it by station name and receive colour-coded feedback across five categories.

## Playing

Live at: https://jack-sleath.github.io/traindle/

Each guess reveals feedback for:
- **Operator** — green if all operators match, orange if some match, red if none match
- **Region** — green if same region, orange if neighbouring region, red otherwise
- **Platforms** — green if exact match, ⬆️/⬇️ indicating whether the mystery has more or fewer
- **Footfall band** — green if same band (`<100k` / `100k-1m` / `1m-10m` / `10m+`), ⬆️/⬇️ otherwise
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

All data generation scripts live in `scripts/`. The pipeline is:

```
fetch_raw_stations.py     →   scripts/raw-stations.json  ─┐
                                                           ├→  compile-stations.ts  →  public/stations.json
scrape_stations_nrdp.py   →   scripts/uk_stations.json  ──┘
```

**Prerequisites:** Python 3, `requests` library

```bash
pip install requests
```

### Step 0 — Fetch the base station list

Downloads the station name, CRS code, coordinates and constituent country from [davwheat/uk-railway-stations](https://github.com/davwheat/uk-railway-stations) (licensed ODbL):

```bash
python scripts/fetch_raw_stations.py
```

This writes `scripts/raw-stations.json`.

### Step 1 — Scrape operator data from National Rail

**Prerequisites:** Python 3, `requests` library

```bash
pip install requests
```

Register a free account at [opendata.nationalrail.co.uk](https://opendata.nationalrail.co.uk) and subscribe to:
- **Knowledgebase (KB) API**
- **DTD** (Darwin Timetable Data)

Then run from the repo root:

```bash
python scripts/scrape_stations_nrdp.py --username you@email.com --password yourpassword
```

This writes `scripts/uk_stations.json` — a map of CRS code → station record including the full list of train operators that call at each station.

### Step 2 — Compile the game data

```bash
npx ts-node --project scripts/tsconfig.json scripts/compile-stations.ts
```

This reads:
- `scripts/raw-stations.json` — base station list from [davwheat/uk-railway-stations](https://github.com/davwheat/uk-railway-stations) (name, CRS, coordinates, constituent country)
- `scripts/uk_stations.json` — operator lists from Step 1

And writes `public/stations.json` with all fields the game needs: name, CRS, operators, region, platforms, footfall band, station type.

---

## Data sources

- **Base station list:** [davwheat/uk-railway-stations](https://github.com/davwheat/uk-railway-stations) (names, CRS codes, coordinates) — licensed ODbL
- **Operator / timetable data:** [National Rail Open Data Portal](https://opendata.nationalrail.co.uk) (Knowledgebase + DTD timetable feeds) — free with registration

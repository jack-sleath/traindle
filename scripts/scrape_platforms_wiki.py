#!/usr/bin/env python3
"""
Crawls Wikipedia to fill in missing platform counts in uk_stations.json.

For each station with platforms=null, tries the Wikipedia page for
"<Name> railway station" (and fallback variants), extracts the
| platforms = N field from the infobox, and writes it back.

Progress is saved after every station so the script can be safely
interrupted and re-run — already-populated entries are skipped.

Usage:
    python scripts/scrape_platforms_wiki.py [--dry-run] [--limit N]

Options:
    --dry-run   Print what would be written without modifying the file
    --limit N   Only process N stations (useful for testing)
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
UK_STATIONS_PATH = SCRIPT_DIR / 'uk_stations.json'

WIKI_API = 'https://en.wikipedia.org/w/api.php'
USER_AGENT = 'traindle-platform-scraper/1.0 (https://github.com/jack-sleath/traindle)'
RATE_LIMIT_S = 0.3   # seconds between API calls


def wiki_get(params: dict) -> dict | None:
    params['format'] = 'json'
    url = WIKI_API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f'    [HTTP error] {e}', file=sys.stderr)
        return None


def fetch_wikitext(title: str) -> str | None:
    """Fetch raw wikitext for a page title. Returns None if not found."""
    data = wiki_get({
        'action': 'parse',
        'page': title,
        'prop': 'wikitext',
        'redirects': '1',
    })
    if not data or 'error' in data:
        return None
    return data.get('parse', {}).get('wikitext', {}).get('*')


def search_wiki(query: str) -> str | None:
    """Search Wikipedia and return wikitext of the top result."""
    data = wiki_get({
        'action': 'query',
        'list': 'search',
        'srsearch': query,
        'srlimit': 3,
        'srnamespace': 0,
    })
    if not data:
        return None
    results = data.get('query', {}).get('search', [])
    for result in results:
        title = result['title']
        time.sleep(RATE_LIMIT_S)
        wikitext = fetch_wikitext(title)
        if wikitext and looks_like_station_page(wikitext):
            return wikitext
    return None


def looks_like_station_page(wikitext: str) -> bool:
    """Heuristic: does this wikitext describe a railway station?"""
    lower = wikitext.lower()
    return (
        'railway station' in lower or
        'train station' in lower or
        '| platforms' in lower or
        'infobox uk station' in lower or
        'infobox station' in lower
    )


def extract_platforms(wikitext: str) -> int | None:
    """
    Extract platform count from infobox wikitext.
    Handles forms like:
        | platforms = 5
        | platforms  = 2 (1 island platform)
        | platforms = {{Nowrap|6}}
    """
    match = re.search(r'\|\s*platforms\s*=\s*[^\d]*(\d+)', wikitext, re.IGNORECASE)
    if match:
        val = int(match.group(1))
        # Sanity check: UK stations have 1–30 platforms
        if 1 <= val <= 30:
            return val
    return None


def name_variants(name: str) -> list[str]:
    """
    Return name variants to try as Wikipedia title bases.

    If the name contains parentheses (e.g. "Stratford (London)"),
    produce both the full name and the name with the bracketed portion
    stripped (e.g. "Stratford").  Always includes the original name.
    """
    variants = [name]
    stripped = re.sub(r'\s*\(.*?\)', '', name).strip()
    if stripped and stripped != name:
        variants.append(stripped)
    return variants


def get_platforms_for_station(name: str) -> tuple[int | None, str]:
    """
    Try multiple Wikipedia title strategies for a station.
    Returns (platform_count_or_None, strategy_used).

    For each name variant (with/without bracketed section), tries:
      1. "<name> railway station"
      2. "<name> station"
    Then falls back to a Wikipedia search using "railway station".
    """
    for variant in name_variants(name):
        candidates = [
            (f'{variant} railway station', f'"{variant} railway station"'),
            (f'{variant} station',         f'"{variant} station"'),
        ]
        for title, label in candidates:
            wikitext = fetch_wikitext(title)
            time.sleep(RATE_LIMIT_S)
            if wikitext and looks_like_station_page(wikitext):
                platforms = extract_platforms(wikitext)
                if platforms is not None:
                    return platforms, label
                # Page found but no platform field — skip remaining variants
                return None, f'{label} (no platform field)'

    # Fall back to Wikipedia search, trying with and without "UK"
    for variant in name_variants(name):
        for query in [
            f'{variant} railway station UK',
            f'{variant} railway station',
        ]:
            wikitext = search_wiki(query)
            time.sleep(RATE_LIMIT_S)
            if wikitext:
                platforms = extract_platforms(wikitext)
                if platforms is not None:
                    return platforms, f'search: "{query}"'
                return None, f'search: "{query}" (no platform field)'

    return None, 'not found'


def main():
    parser = argparse.ArgumentParser(description='Crawl Wikipedia for station platform counts.')
    parser.add_argument('--dry-run', action='store_true', help='Print results without writing')
    parser.add_argument('--limit', type=int, default=None, help='Max stations to process')
    args = parser.parse_args()

    with open(UK_STATIONS_PATH, encoding='utf-8') as f:
        stations = json.load(f)

    missing = {
        crs: s for crs, s in stations.items()
        if not s.get('platforms')
    }

    if args.limit:
        missing = dict(list(missing.items())[:args.limit])

    total = len(missing)
    print(f'{total} stations missing platform data (dry_run={args.dry_run})\n')

    found_count = 0
    not_found = []

    for i, (crs, station) in enumerate(missing.items(), 1):
        name = station['name']
        print(f'[{i:4d}/{total}] {crs:4s}  {name}', end=' ... ', flush=True)

        platforms, strategy = get_platforms_for_station(name)

        if platforms is not None:
            print(f'{platforms} platforms  [{strategy}]')
            found_count += 1
            if not args.dry_run:
                stations[crs]['platforms'] = platforms
                # Save after every update so interrupts lose minimal work
                with open(UK_STATIONS_PATH, 'w', encoding='utf-8') as f:
                    json.dump(stations, f, indent=2, ensure_ascii=False)
        else:
            print(f'-  [{strategy}]')
            not_found.append(crs)

    print(f'\n-------------------------------------')
    print(f'Done.  Found: {found_count}/{total}  |  Still missing: {len(not_found)}')
    if not_found:
        preview = ', '.join(not_found[:20])
        suffix = f' … (+{len(not_found) - 20} more)' if len(not_found) > 20 else ''
        print(f'Still missing CRS codes: {preview}{suffix}')
    if not args.dry_run and found_count:
        print(f'\nuk_stations.json updated. Re-run compile-stations.ts to rebuild stations.json.')


if __name__ == '__main__':
    main()

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


def wiki_url(title: str) -> str:
    """Return the Wikipedia article URL for a given page title."""
    return 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(title.replace(' ', '_'), safe='_-()')


def search_wiki(query: str) -> tuple[str, str] | tuple[None, None]:
    """Search Wikipedia and return (wikitext, title) of the top matching result."""
    data = wiki_get({
        'action': 'query',
        'list': 'search',
        'srsearch': query,
        'srlimit': 3,
        'srnamespace': 0,
    })
    if not data:
        return None, None
    results = data.get('query', {}).get('search', [])
    for result in results:
        title = result['title']
        time.sleep(RATE_LIMIT_S)
        wikitext = fetch_wikitext(title)
        if wikitext and is_disambiguation_page(wikitext):
            best = best_uk_railway_link(wikitext)
            if not best:
                continue
            time.sleep(RATE_LIMIT_S)
            wikitext = fetch_wikitext(best)
            title = best
        if wikitext and looks_like_station_page(wikitext) and looks_like_uk_station_page(wikitext):
            return wikitext, title
    return None, None


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


_UK_COUNTRY_TERMS = frozenset({
    'united kingdom', 'england', 'scotland', 'wales', 'northern ireland', 'great britain',
})


def looks_like_uk_station_page(wikitext: str) -> bool:
    """
    Returns True if the page is specifically a UK railway station.
    - 'Infobox UK station' template → definitely UK.
    - Explicit '| country = ...' field → check against known UK terms.
    - No country field → assume UK (benefit of the doubt).
    """
    if re.search(r'infobox uk station', wikitext, re.IGNORECASE):
        return True
    m = re.search(r'\|\s*country\s*=\s*([^\n|{]+)', wikitext, re.IGNORECASE)
    if m:
        country = re.sub(r'[\[\]]', '', m.group(1)).strip().lower()
        return any(term in country for term in _UK_COUNTRY_TERMS)
    return True  # no country field — assume UK


def is_disambiguation_page(wikitext: str) -> bool:
    """Return True if the wikitext is a Wikipedia disambiguation page."""
    return bool(re.search(
        r'\{\{[Dd]isambig|\{\{[Rr]ailway.station.disambig|\{\{[Ss]tation.disambig',
        wikitext,
    ))


_UK_LINK_TERMS = frozenset({
    'england', 'scotland', 'wales', 'northern ireland', 'uk', 'united kingdom',
    'great britain', 'english', 'scottish', 'welsh',
    'london', 'yorkshire', 'lancashire', 'kent', 'essex', 'surrey', 'sussex',
    'hampshire', 'berkshire', 'oxfordshire', 'warwickshire', 'derbyshire',
    'nottinghamshire', 'lincolnshire', 'norfolk', 'suffolk', 'devon', 'cornwall',
    'somerset', 'gloucestershire', 'worcestershire', 'shropshire', 'cheshire',
    'merseyside', 'greater manchester', 'west yorkshire', 'south yorkshire',
    'tyne and wear', 'durham', 'cumbria', 'northumberland', 'west dunbartonshire',
    'strathclyde', 'highland', 'fife', 'aberdeenshire', 'lothian',
})


def best_uk_railway_link(wikitext: str) -> str | None:
    """
    From a disambiguation page, return the title of the wikilink most likely
    to be a UK railway station, or None if no plausible candidate is found.
    Scoring: 'railway station' in link = +4, 'train/station' = +1-3,
             UK location term in link = +2.  Requires score >= 3.
    """
    links = re.findall(r'\[\[([^\]|#]+)', wikitext)
    best, best_score = None, 0
    for link in links:
        lower = link.lower()
        score = 0
        if 'railway station' in lower:
            score += 4
        elif 'train station' in lower:
            score += 3
        elif 'station' in lower:
            score += 1
        if any(t in lower for t in _UK_LINK_TERMS):
            score += 2
        if score > best_score:
            best_score = score
            best = link
    return best if best_score >= 3 else None


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
    stripped = re.sub(r'\s*\(.*?\)', '', name).strip()
    if stripped and stripped != name:
        return [stripped, name]
    return [name]


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
            if wikitext and is_disambiguation_page(wikitext):
                best = best_uk_railway_link(wikitext)
                if best:
                    wikitext = fetch_wikitext(best)
                    time.sleep(RATE_LIMIT_S)
                    label = f'{label} -> "{best}"'
                    title = best
                else:
                    continue  # Disambiguation with no UK railway link — try next
            if wikitext and looks_like_station_page(wikitext):
                if not looks_like_uk_station_page(wikitext):
                    continue  # Non-UK station page — try next variant
                platforms = extract_platforms(wikitext)
                if platforms is not None:
                    return platforms, label
                # No platform field — log and try remaining candidates
                print(f'\n    (no platform field: {wiki_url(title)})', end='', flush=True)

    # Fall back to Wikipedia search, trying with and without "UK"
    for variant in name_variants(name):
        for query in [
            f'{variant} railway station UK',
            f'{variant} railway station',
        ]:
            wikitext, matched_title = search_wiki(query)
            time.sleep(RATE_LIMIT_S)
            if wikitext:
                platforms = extract_platforms(wikitext)
                if platforms is not None:
                    return platforms, f'search: "{query}"'
                print(f'\n    (no platform field: {wiki_url(matched_title)})', end='', flush=True)

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

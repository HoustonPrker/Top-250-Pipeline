"""
CK Analytics — Nightly Data Export
====================================
Fetches pipeline and daily sales data from the Counterpoint REST API
and writes them to CSV files in the data/ folder.

Schedule this script to run nightly after the database views are rebuilt
(e.g. Windows Task Scheduler, 6:00 AM).

Requirements:
    pip install requests

Usage:
    python scripts/export_data.py

Output:
    data/CK_math_pipeline_data.csv
    data/CK_daily_sales.csv
"""

import csv
import os
import sys
import time
import requests
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Configuration ─────────────────────────────────────────────

API_BASE    = 'http://172.16.20.185:8085'
API_KEY     = '26G3t29ecBtvmGpbKOoVnql34eNYfUoy'
PAGE_SIZE   = 200
MAX_WORKERS = 10   # parallel page fetches

# Resolve data/ folder relative to this script
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(SCRIPT_DIR, '..', 'data')

EXPORTS = [
    {
        'view':     'USER_VI_CK_Pipeline',
        'filename': 'CK_math_pipeline_data.csv',
        'label':    'Pipeline data',
    },
    {
        'view':     'USER_VI_CK_DailySales',
        'filename': 'CK_daily_sales.csv',
        'label':    'Daily sales',
    },
]

# ── API helpers ───────────────────────────────────────────────

SESSION = requests.Session()
SESSION.headers.update({'X-Api-Key': API_KEY})


def api_get(path, retries=3):
    """GET from the API with simple retry on transient errors."""
    url = API_BASE + path
    for attempt in range(retries):
        try:
            r = SESSION.get(url, timeout=30)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # 1s, 2s backoff
            else:
                raise RuntimeError(f'API request failed after {retries} attempts: {url}\n{e}')


def fetch_page(view, page):
    """Fetch a single page from a /tables/ view."""
    path = (
        f'/api/v1/tables/{view}/rows'
        f'?pageSize={PAGE_SIZE}&compact=true&page={page}'
    )
    json = api_get(path)
    envelope = json.get('data', {})
    return envelope.get('data', []), envelope


def fetch_all_rows(view, label):
    """
    Fetch all rows from a view using parallel page requests.
    Returns a list of row dicts.
    """
    print(f'  Fetching page 1 to get total count...')
    first_rows, envelope = fetch_page(view, 1)

    total_count = envelope.get('totalCount', 0)
    total_pages = envelope.get('totalPages', 1)
    print(f'  {label}: {total_count:,} rows across {total_pages} pages')

    all_rows = list(first_rows)

    if total_pages <= 1:
        return all_rows

    # Fetch remaining pages in parallel
    remaining = list(range(2, total_pages + 1))

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_page, view, p): p for p in remaining}
        completed = 0
        for future in as_completed(futures):
            rows, _ = future.result()
            all_rows.extend(rows)
            completed += 1
            pct = int(((completed + 1) / total_pages) * 100)
            print(f'\r  Progress: {len(all_rows):,} / {total_count:,} rows ({pct}%)', end='', flush=True)

    print()  # newline after progress
    return all_rows


def write_csv(rows, filepath, label):
    """Write a list of dicts to a CSV file."""
    if not rows:
        print(f'  WARNING: No rows returned for {label} — skipping write.')
        return

    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    fieldnames = list(rows[0].keys())
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    size_kb = os.path.getsize(filepath) / 1024
    print(f'  Wrote {len(rows):,} rows → {os.path.basename(filepath)} ({size_kb:.0f} KB)')


# ── Main ──────────────────────────────────────────────────────

def main():
    start = datetime.now()
    print(f'CK Analytics Export — {start.strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'Output folder: {os.path.abspath(DATA_DIR)}\n')

    errors = []

    for export in EXPORTS:
        view     = export['view']
        filename = export['filename']
        label    = export['label']
        filepath = os.path.join(DATA_DIR, filename)

        print(f'[{label}]')
        try:
            rows = fetch_all_rows(view, label)
            write_csv(rows, filepath, label)
        except Exception as e:
            print(f'  ERROR: {e}')
            errors.append((label, str(e)))
        print()

    elapsed = (datetime.now() - start).total_seconds()
    print(f'Done in {elapsed:.1f}s')

    if errors:
        print(f'\n{len(errors)} export(s) failed:')
        for label, msg in errors:
            print(f'  • {label}: {msg}')
        sys.exit(1)
    else:
        print('All exports completed successfully.')


if __name__ == '__main__':
    main()

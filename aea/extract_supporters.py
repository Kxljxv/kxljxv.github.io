#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract supporters (weitere Antragsteller*innen) from saved Antragsgrün HTML pages
and write them to antragstellerinnen.csv with columns:
motion_code,motion_title,role,name,kv,source

Usage:
    python extract_supporters.py [HTML_FILE ...]
If no files are provided, scans all *.html in the current directory.
"""
import os
import re
import sys
import csv
import json
import glob
import html
from typing import List, Tuple, Optional
import urllib.request
import urllib.error
import time


def read_text(path: str) -> str:
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


def strip_tags(s: str) -> str:
    # remove tags
    s = re.sub(r"<[^>]+>", " ", s)
    # unescape
    s = html.unescape(s)
    # normalize spaces
    s = re.sub(r"\s+", " ", s).strip()
    return s


def get_saved_from_url(doc: str) -> Optional[str]:
    m = re.search(r"<!--\s*saved from url=\([^)]+\)(.*?)-->", doc, re.IGNORECASE | re.DOTALL)
    if m:
        return strip_tags(m.group(1))
    # Fallback: try to read current page canonical via motionDataTable link (may be motion not amendment)
    m2 = re.search(r"<a\s+href=\"(https?://[^\"]+)\"[^>]*>#supporters\<", doc)
    if m2:
        return m2.group(1)
    return None


def get_motion_info(doc: str) -> Tuple[Optional[str], Optional[str]]:
    # Prefer H1 text
    m = re.search(r"<h1[^>]*>(.*?)</h1>", doc, re.DOTALL | re.IGNORECASE)
    text = strip_tags(m.group(1)) if m else None
    if not text:
        # Fallback to <title>
        t = re.search(r"<title[^>]*>(.*?)</title>", doc, re.DOTALL | re.IGNORECASE)
        text = strip_tags(t.group(1)) if t else None
    if not text:
        return None, None
    # Expect pattern: CODE: Title
    parts = text.split(":", 1)
    if len(parts) == 2:
        code = parts[0].strip()
        title = parts[1].strip()
        return code, title
    # Fallback: last breadcrumb element often contains code
    bc = re.search(r"<ol[^>]*class=\"breadcrumb\"[^>]*>.*?<li>\s*([^<]+)\s*</li>\s*</ol>", doc, re.DOTALL | re.IGNORECASE)
    code = strip_tags(bc.group(1)) if bc else None
    return code, text


def find_supporters_list_html(doc: str) -> Optional[str]:
    # Try section with id="supporters"
    sec = re.search(r"<section[^>]*id=\"supporters\"[^>]*>(.*?)</section>", doc, re.DOTALL | re.IGNORECASE)
    if sec:
        sec_html = sec.group(1)
        # Prefer fullList
        ul_full = re.search(r"<ul[^>]*class=\"[^\"]*\bfullList\b[^\"]*\"[^>]*>(.*?)</ul>", sec_html, re.DOTALL | re.IGNORECASE)
        if ul_full:
            return ul_full.group(1)
        # Else shortList
        ul_short = re.search(r"<ul[^>]*class=\"[^\"]*\bshortList\b[^\"]*\"[^>]*>(.*?)</ul>", sec_html, re.DOTALL | re.IGNORECASE)
        if ul_short:
            return ul_short.group(1)
        return sec_html
    # Fallback: search anywhere
    ul_full = re.search(r"<ul[^>]*class=\"[^\"]*\bfullList\b[^\"]*\"[^>]*>(.*?)</ul>", doc, re.DOTALL | re.IGNORECASE)
    if ul_full:
        return ul_full.group(1)
    ul_short = re.search(r"<ul[^>]*class=\"[^\"]*\bshortList\b[^\"]*\"[^>]*>(.*?)</ul>", doc, re.DOTALL | re.IGNORECASE)
    if ul_short:
        return ul_short.group(1)
    # Another variant: list items under supporters section without ul classes
    sec2 = re.search(r"<h2[^>]*>\s*(weitere\s+Antragsteller\*innen|Unterst[üu]tzer\*innen)\s*</h2>.*?(<ul[\s\S]*?</ul>)", doc, re.IGNORECASE | re.DOTALL)
    if sec2:
        return sec2.group(2)
    return None


def parse_supporters(list_html: str) -> List[Tuple[str, str]]:
    supporters = []
    if not list_html:
        return supporters
    # Extract all li items
    for li in re.findall(r"<li[^>]*>(.*?)</li>", list_html, re.DOTALL | re.IGNORECASE):
        text = strip_tags(li)
        if not text:
            continue
        # Filter out non-supporter noise like buttons or counts
        # Expect patterns like: Name (KV Something)
        name = text
        kv = ""
        m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", text)
        if m:
            name = m.group(1).strip()
            kv = m.group(2).strip()
        # Skip obvious non-person entries
        if len(name) < 2:
            continue
        supporters.append((name, kv))
    return supporters


def read_amendments_csv(path: str) -> List[str]:
    urls: List[str] = []
    with open(path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        field_candidates = ['url', 'href', 'link']
        chosen_field = None
        for c in field_candidates:
            if c in reader.fieldnames:
                chosen_field = c
                break
        if not chosen_field:
            raise ValueError(f"Keine URL-Spalte in {path} gefunden. Erwartet eine der {field_candidates}.")
        for row in reader:
            u = (row.get(chosen_field) or '').strip()
            if not u:
                continue
            urls.append(u)
    seen = set()
    unique_urls: List[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique_urls.append(u)
    return unique_urls

def read_amendments_json(path: str) -> List[str]:
    urls: List[str] = []
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and 'url' in item:
                    u = item['url'].strip()
                    if u:
                        urls.append(u)
        elif isinstance(data, dict):
            # Falls es ein dict mit einer Liste ist
            for key in data:
                if isinstance(data[key], list):
                    for item in data[key]:
                        if isinstance(item, dict) and 'url' in item:
                            u = item['url'].strip()
                            if u:
                                urls.append(u)
    seen = set()
    unique_urls: List[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique_urls.append(u)
    return unique_urls


def fetch_url(url: str, timeout: float = 20.0) -> str:
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        ct = resp.headers.get('Content-Type', '')
        charset = 'utf-8'
        m = re.search(r'charset=([^;\s]+)', ct, re.IGNORECASE)
        if m:
            charset = m.group(1).strip()
        try:
            return data.decode(charset, errors='ignore')
        except Exception:
            return data.decode('utf-8', errors='ignore')


def process_url(url: str) -> Tuple[Optional[str], Optional[Tuple[str, str]], List[Tuple[str, str]]]:
    doc = fetch_url(url)
    code, _title = get_motion_info(doc)
    # Initiator separat extrahieren
    initiator = parse_initiator(doc)
    initiator_tuple = None
    if initiator:
        initiator_tuple = (initiator[0].strip(), initiator[1].strip())
    
    # Weitere Antragsteller*innen
    list_html = find_supporters_list_html(doc)
    sups = parse_supporters(list_html or '')
    
    # Deduplicate supporters (exclude initiator if present)
    seen = set()
    if initiator_tuple:
        seen.add((initiator_tuple[0], initiator_tuple[1]))
    
    supporters: List[Tuple[str, str]] = []
    for name, kv in sups:
        key = (name.strip(), kv.strip())
        if key not in seen:
            seen.add(key)
            supporters.append((name.strip(), kv.strip()))
    
    return code, initiator_tuple, supporters


def parse_initiator(doc: str) -> Optional[Tuple[str, str]]:
    # Find the table row for initiator
    m = re.search(r"<tr[^>]*>\s*<th[^>]*>\s*Antragsteller\*in:?\s*</th>\s*<td[^>]*>(.*?)</td>", doc, re.IGNORECASE | re.DOTALL)
    if not m:
        # Some pages might use plural or slight variation
        m = re.search(r"<tr[^>]*>\s*<th[^>]*>\s*Antragsteller[^<]*\s*</th>\s*<td[^>]*>(.*?)</td>", doc, re.IGNORECASE | re.DOTALL)
        if not m:
            return None
    inner = m.group(1)
    # Remove the moreSupporters div to isolate initiator line
    inner = re.split(r"<div[^>]*class=\"[^\"]*moreSupporters[^\"]*\"[^>]*>", inner, maxsplit=1, flags=re.IGNORECASE)[0]
    text = strip_tags(inner)
    # Extract name and KV from pattern "Name (KV Something)"
    m2 = re.match(r"^(.*?)\s*\((KV[^)]*)\)\s*$", text)
    if m2:
        name = m2.group(1).strip()
        kv = m2.group(2).strip()
        return name, kv
    # If KV not in parentheses, try small tag content
    m3 = re.search(r"<small[^>]*>\s*\(([^)]*)\)\s*</small>", inner, re.IGNORECASE | re.DOTALL)
    if m3:
        kv = strip_tags(m3.group(1)).strip()
        if not kv.startswith("KV"):
            kv = f"KV {kv}" if kv else ""
        name = strip_tags(re.sub(r"<small[\s\S]*</small>", "", inner)).strip()
        return name, kv
    # Fallback: return text only
    if text:
        return text, ""
    return None


def main():
    import pprint
    args = sys.argv[1:]
    urls: List[str] = []
    if not args:
        # Versuche zuerst JSON, dann CSV
        default_json = os.path.join(os.getcwd(), 'amendments_url.json')
        default_csv = os.path.join(os.getcwd(), 'amendments.csv')
        if os.path.isfile(default_json):
            urls = read_amendments_json(default_json)
            print(f"Lese {len(urls)} URLs aus {default_json}")
        elif os.path.isfile(default_csv):
            urls = read_amendments_csv(default_csv)
            print(f"Lese {len(urls)} URLs aus {default_csv}")
        else:
            print('amendments_url.json oder amendments.csv nicht gefunden. Übergib entweder eine Datei oder URL(s).')
            sys.exit(1)
    else:
        if len(args) == 1:
            if args[0].lower().endswith('.json') and os.path.isfile(args[0]):
                urls = read_amendments_json(args[0])
                print(f"Lese {len(urls)} URLs aus {args[0]}")
            elif args[0].lower().endswith('.csv') and os.path.isfile(args[0]):
                urls = read_amendments_csv(args[0])
                print(f"Lese {len(urls)} URLs aus {args[0]}")
            elif args[0].startswith('http'):
                urls = [args[0]]
            else:
                print('Keine gültige Datei oder URL übergeben.')
                sys.exit(1)
        else:
            urls = [a for a in args if a.startswith('http')]
            if not urls:
                print('Keine gültigen URLs übergeben. Übergib eine JSON/CSV-Datei oder mindestens eine http(s)-URL.')
                sys.exit(1)
    support_map: dict = {}
    total = len(urls)
    for i, url in enumerate(urls, 1):
        try:
            code, initiator, supporters = process_url(url)
            total_people = (1 if initiator else 0) + len(supporters)
            print(f"[{i}/{total}] {url}: {total_people} Personen (1 Initiator, {len(supporters)} Supporters)")
            if code:
                # Store as dict with initiator and supporters
                support_map[code] = {
                    "initiator": list(initiator) if initiator else None,
                    "supporters": [[name, kv] for name, kv in supporters]
                }
        except urllib.error.HTTPError as e:
            print(f"[{i}/{total}] HTTP-Fehler {e.code} bei {url}")
        except urllib.error.URLError as e:
            print(f"[{i}/{total}] URL-Fehler {e.reason} bei {url}")
        except Exception as e:
            print(f"[{i}/{total}] Fehler bei {url}: {e}")
        time.sleep(0.2)
    out_path = os.path.join(os.getcwd(), 'antragstellerinnen.txt')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(pprint.pformat(support_map, width=120, compact=True, sort_dicts=True))
    print(f"Wrote dict with {len(support_map)} keys to {out_path}")


if __name__ == '__main__':
    main()
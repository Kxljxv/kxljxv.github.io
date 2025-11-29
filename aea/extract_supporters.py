#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Erzeugt die finale graph_data.json mit folgendem Format:

{
  "motions": [
    {
      "code": "VR-01-025",
      "applicant": ["Name", "KV …"],
      "supporters": [["Name", "KV …"], ...],
      "url": "https://…"
    },
    ...
  ]
}

Quelle ist die Datei amendments_url.json mit einer Liste von Objekten
{ "title": "VR-01-025", "url": "https://…" }.

Benutzung:
    python extract_supporters.py
"""
import os
import re
import sys
import json
import html
from typing import List, Tuple, Optional, Dict, Any
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


def read_amendments_json(path: str) -> List[Dict[str, str]]:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    items: List[Dict[str, str]] = []
    for item in data:
        title = (item.get('title') or '').strip()
        url = (item.get('url') or '').strip()
        if title and url:
            items.append({ 'title': title, 'url': url })
    return items


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
    applicant = parse_initiator(doc)
    list_html = find_supporters_list_html(doc)
    sups = parse_supporters(list_html or '')
    # Deduplicate supporters (exclude applicant from supporters)
    seen = set()
    result: List[Tuple[str, str]] = []
    for pair in sups:
        key = (pair[0].strip(), (pair[1] or '').strip())
        if applicant and key == (applicant[0].strip(), (applicant[1] or '').strip()):
            continue
        if key in seen:
            continue
        seen.add(key)
        result.append(key)
    return code, applicant, result


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
    items = []
    json_path = os.path.join(os.getcwd(), 'amendments_url.json')
    if not os.path.isfile(json_path):
        print('amendments_url.json nicht gefunden.')
        sys.exit(1)
    items = read_amendments_json(json_path)
    total = len(items)
    motions: List[Dict[str, Any]] = []
    for i, item in enumerate(items, 1):
        url = item['url']
        try:
            code, applicant, supporters = process_url(url)
            code = code or item['title']
            print(f"[{i}/{total}] {code}: {1 if applicant else 0} Antragsteller*in, {len(supporters)} Supporter")
            motions.append({
                'code': code,
                'applicant': [applicant[0], applicant[1]] if applicant else None,
                'supporters': [[n, kv] for n, kv in supporters],
                'url': url
            })
        except urllib.error.HTTPError as e:
            print(f"[{i}/{total}] HTTP-Fehler {e.code} bei {url}")
        except urllib.error.URLError as e:
            print(f"[{i}/{total}] URL-Fehler {e.reason} bei {url}")
        except Exception as e:
            print(f"[{i}/{total}] Fehler bei {url}: {e}")
        time.sleep(0.2)
    out = { 'motions': motions, 'metadata': { 'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()) } }
    out_path = os.path.join(os.getcwd(), 'graph_data.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"JSON mit {len(motions)} Anträgen gespeichert → {out_path}")


if __name__ == '__main__':
    main()

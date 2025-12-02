#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Erzeugt eine aggregierte graph_data.json über mehrere LDK/LA-Seiten.
Format:
{
  "motions": [
    {
      "code": "VR-01-025",
      "applicant": ["Name", "KV …"],
      "supporters": [["Name", "KV …"], ...],
      "url": "https://…"
    },
    ...
  ],
  "metadata": { "generated_at": "…", "roots": ["…"] }
}
Benutzung:
    python extract_supporters.py
"""
import os
import re
import sys
import json
import html
from typing import List, Tuple, Optional, Dict, Any, Set
import urllib.request
import urllib.error
import time
import urllib.parse


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
    m2 = re.search(r"<link[^>]*rel=\"canonical\"[^>]*href=\"(https?://[^\"]+)\"", doc, re.IGNORECASE)
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
    sec = re.search(r"<section[^>]*id=\"supporters\"[^>]*>(.*?)</section>", doc, re.DOTALL | re.IGNORECASE)
    if sec:
        sec_html = sec.group(1)
        ul_full = re.search(r"<ul[^>]*class=\"[^\"]*\bfullList\b[^\"]*\"[^>]*>(.*?)</ul>", sec_html, re.DOTALL | re.IGNORECASE)
        if ul_full:
            return ul_full.group(1)
        ul_short = re.search(r"<ul[^>]*class=\"[^\"]*\bshortList\b[^\"]*\"[^>]*>(.*?)</ul>", sec_html, re.DOTALL | re.IGNORECASE)
        if ul_short:
            return ul_short.group(1)
        return sec_html
    ul_full = re.search(r"<ul[^>]*class=\"[^\"]*\bfullList\b[^\"]*\"[^>]*>(.*?)</ul>", doc, re.DOTALL | re.IGNORECASE)
    if ul_full:
        return ul_full.group(1)
    ul_short = re.search(r"<ul[^>]*class=\"[^\"]*\bshortList\b[^\"]*\"[^>]*>(.*?)</ul>", doc, re.DOTALL | re.IGNORECASE)
    if ul_short:
        return ul_short.group(1)
    sec2 = re.search(r"<h2[^>]*>\s*(weitere\s+Antragsteller\*innen|Unterst[üu]tzer\*innen)\s*</h2>.*?(<ul[\s\S]*?</ul>)", doc, re.IGNORECASE | re.DOTALL)
    if sec2:
        return sec2.group(2)
    div_sup = re.search(r"<div[^>]*class=\"[^\"]*\bsupporters\b[^\"]*\"[^>]*>([\s\S]*?)</div>", doc, re.IGNORECASE)
    if div_sup:
        return div_sup.group(1)
    return None


def parse_supporters(list_html: str) -> List[Tuple[str, str]]:
    supporters = []
    if not list_html:
        return supporters
    for li in re.findall(r"<li[^>]*>(.*?)</li>", list_html, re.DOTALL | re.IGNORECASE):
        text = strip_tags(li)
        if not text:
            continue
        name = text
        kv = ""
        m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", text)
        if m:
            name = m.group(1).strip()
            kv = m.group(2).strip()
        if kv and not kv.startswith("KV"):
            kv = f"KV {kv}"
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
    seen: Set[Tuple[str, str]] = set()
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
    m = re.search(r"<tr[^>]*>\s*<th[^>]*>\s*(Antragsteller\*?in(?:nen)?|Antragsteller[^<]*|Initiator[^<]*|Einreicher[^<]*|Autor[^<]*|Erstunterzeichner[^<]*|Einreichende[^<]*)\s*</th>\s*<td[^>]*>(.*?)</td>", doc, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    inner = m.group(2)
    inner = re.split(r"<div[^>]*class=\"[^\"]*moreSupporters[^\"]*\"[^>]*>", inner, maxsplit=1, flags=re.IGNORECASE)[0]
    text = strip_tags(inner)
    m2 = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", text)
    if m2:
        name = m2.group(1).strip()
        kv = m2.group(2).strip()
        if not kv.startswith("KV") and kv:
            kv = f"KV {kv}"
        return name, kv
    m3 = re.search(r"<small[^>]*>\s*\(([^)]*)\)\s*</small>", inner, re.IGNORECASE | re.DOTALL)
    if m3:
        kv = strip_tags(m3.group(1)).strip()
        if not kv.startswith("KV"):
            kv = f"KV {kv}" if kv else ""
        name = strip_tags(re.sub(r"<small[\s\S]*</small>", "", inner)).strip()
        return name, kv
    if text:
        return text, ""
    return None


def extract_links(doc: str, base: str) -> List[str]:
    links = []
    for m in re.finditer(r"<a\s+href=\"(.*?)\"", doc, re.IGNORECASE):
        href = html.unescape(m.group(1))
        if not href:
            continue
        abs_url = urllib.parse.urljoin(base, href)
        if not abs_url.startswith(base):
            continue
        if abs_url.endswith('.pdf'):
            continue
        if '#' in abs_url:
            abs_url = abs_url.split('#')[0]
        links.append(abs_url)
    return list(dict.fromkeys(links))


def is_motion_like(doc: str) -> bool:
    if re.search(r"<section[^>]*id=\"supporters\"", doc, re.IGNORECASE):
        return True
    if re.search(r"<tr[^>]*>\s*<th[^>]*>\s*(Antragsteller|Initiator|Einreicher|Autor|Erstunterzeichner|Einreichende)", doc, re.IGNORECASE):
        return True
    if re.search(r"Unterst[üu]tzer\*?innen", doc, re.IGNORECASE):
        return True
    if re.search(r"motionDataTable|motionTable|class=\"motion\-content\"", doc, re.IGNORECASE):
        return True
    return False


def crawl_root(root_url: str, max_pages: int = 2000) -> List[str]:
    visited: Set[str] = set()
    queue: List[str] = [root_url]
    motions: List[str] = []
    base = root_url.rstrip('/') + '/'
    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        try:
            doc = fetch_url(url)
        except Exception:
            continue
        if url != root_url and (is_motion_like(doc) or re.search(r"/(motion|amendment)/\d+", url)):
            motions.append(url)
        for link in extract_links(doc, base):
            if link not in visited and link not in queue and link.startswith(base):
                queue.append(link)
        time.sleep(0.1)
    return motions


def main():
    roots = [
        'https://berlin.antragsgruen.de/LDK23-1',
        'https://berlin.antragsgruen.de/LDK23-2',
        'https://berlin.antragsgruen.de/LDK23-3',
        'https://berlin.antragsgruen.de/LDK24-1',
        'https://berlin.antragsgruen.de/LDK24-2',
        'https://berlin.antragsgruen.de/LDK25-1',
        'https://berlin.antragsgruen.de/LDK25-2',
        'https://berlin.antragsgruen.de/LA25-3',
        'https://berlin.antragsgruen.de/LA25-4',
    ]
    all_urls: List[str] = []
    for r in roots:
        try:
            print(f"Crawle {r} …")
            urls = crawl_root(r)
            print(f"→ {len(urls)} Seiten erkannt")
            all_urls.extend(urls)
        except Exception as e:
            print(f"Fehler beim Crawlen von {r}: {e}")
    # eindeutige URLs
    seen_urls: Dict[str, None] = {}
    unique_urls = []
    for u in all_urls:
        if u not in seen_urls:
            seen_urls[u] = None
            unique_urls.append(u)
    total = len(unique_urls)

    motions: List[Dict[str, Any]] = []
    for i, url in enumerate(unique_urls, 1):
        try:
            code, applicant, supporters = process_url(url)
            code = code or url
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

    out = {
        'motions': motions,
        'metadata': {
            'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'roots': roots,
        }
    }
    base_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(base_dir, 'graph_data.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"JSON mit {len(motions)} Anträgen gespeichert → {out_path}")

    supporters_index: Dict[str, List[str]] = {}
    for m in motions:
        code = m.get('code')
        app = m.get('applicant') or []
        if len(app) >= 1 and app[0]:
            key = f"{app[0]} | {app[1] if len(app) > 1 else ''}"
            supporters_index.setdefault(key, []).append(code)
        for s in m.get('supporters') or []:
            key = f"{s[0]} | {s[1] if len(s) > 1 else ''}"
            supporters_index.setdefault(key, []).append(code)

    idx_path = os.path.join(base_dir, 'supporters_index.json')
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump({ 'index': supporters_index }, f, ensure_ascii=False, indent=2)
    print(f"Supporter-Index mit {len(supporters_index)} Personen gespeichert → {idx_path}")


if __name__ == '__main__':
    main()

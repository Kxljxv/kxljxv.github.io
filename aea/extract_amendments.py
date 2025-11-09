#!/usr/bin/env python3
import re
import csv
import sys
import html as html_module
from pathlib import Path


def normalize_text(s: str) -> str:
    # Remove HTML tags
    s = re.sub(r"<[^>]+>", " ", s)
    # Unescape HTML entities
    s = html_module.unescape(s)
    # Collapse whitespace
    return " ".join(s.split())


def extract_amendments(html_content: str):
    amendments = []
    # Find all anchors that denote amendment titles
    anchor_re = re.compile(r"(<a[^>]*class=\"[^\"]*amendmentTitle[^\"]*\"[^>]*>)(.*?)</a>", re.IGNORECASE | re.DOTALL)
    info_re = re.compile(r"<(?:span|p)[^>]*class=\"[^\"]*info[^\"]*\"[^>]*>(.*?)</(?:span|p)>", re.IGNORECASE | re.DOTALL)

    for m in anchor_re.finditer(html_content):
        opening_tag = m.group(1)
        title = normalize_text(m.group(2))
        href_match = re.search(r"href=\"([^\"]+)\"", opening_tag, flags=re.IGNORECASE)
        if not href_match:
            continue
        url = href_match.group(1).strip()

        # Search forward within a reasonable window for the nearest info element
        start = m.end()
        end = min(len(html_content), start + 4000)
        forward_chunk = html_content[start:end]
        info_match = info_re.search(forward_chunk)

        # Fallback: search a little bit backward in case info precedes the anchor
        if not info_match:
            back_start = max(0, m.start() - 2000)
            backward_chunk = html_content[back_start:m.start()]
            info_match = info_re.search(backward_chunk)

        info_text = normalize_text(info_match.group(1)) if info_match else ""

        amendments.append({
            "title": title,
            "url": url,
            "info": info_text,
        })

    return amendments


def main():
    # Determine input HTML path
    if len(sys.argv) > 1:
        html_path = Path(sys.argv[1])
    else:
        html_path = Path(__file__).parent / "51bdk.html"

    if not html_path.exists():
        print(f"Eingabedatei nicht gefunden: {html_path}")
        sys.exit(1)

    html_content = html_path.read_text(encoding="utf-8", errors="ignore")

    amendments = extract_amendments(html_content)

    # Output CSV to the same folder
    out_path = html_path.parent / "amendments.csv"
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["title", "url", "info"])
        writer.writeheader()
        for item in amendments:
            writer.writerow(item)

    print(f"{len(amendments)} Änderungsanträge extrahiert → {out_path}")


if __name__ == "__main__":
    main()
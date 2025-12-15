import os
import json
import urllib.request
import urllib.error

def load_urls():
    data_path = os.path.join(os.path.dirname(__file__), 'data.json')
    urls = {}
    if not os.path.exists(data_path):
        return urls
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict) and data.get('motions') and isinstance(data['motions'], list):
        for m in data['motions']:
            code = m.get('code') or m.get('title') or m.get('antrag') or m.get('id')
            url = m.get('url')
            if code and url:
                urls[code] = url
    elif isinstance(data, dict):
        for key, val in data.items():
            if key == 'metadata':
                continue
            code = (val.get('application_id') or val.get('id')) if isinstance(val, dict) else key
            url = val.get('url') if isinstance(val, dict) else None
            if code and url:
                urls[code] = url
    return urls

def sanitize_filename(name: str) -> str:
    invalid = '<>:"/\\|?*'
    sanitized = ''.join('_' if c in invalid else c for c in name)
    return sanitized.strip()

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)

def download_pdf(code: str, base_url: str, out_dir: str) -> bool:
    pdf_url = base_url.rstrip('/') + '/pdf'
    filename = sanitize_filename(code) + '.pdf'
    out_path = os.path.join(out_dir, filename)
    try:
        with urllib.request.urlopen(pdf_url) as resp:
            content = resp.read()
        with open(out_path, 'wb') as f:
            f.write(content)
        return True
    except (urllib.error.HTTPError, urllib.error.URLError):
        return False

def main():
    urls = load_urls()
    out_dir = os.path.join(os.path.dirname(__file__), 'pdf')
    ensure_dir(out_dir)
    success = 0
    total = 0
    for code, url in urls.items():
        total += 1
        if download_pdf(code, url, out_dir):
            success += 1
    print(f'Downloaded {success}/{total} PDFs to {out_dir}')

if __name__ == '__main__':
    main()

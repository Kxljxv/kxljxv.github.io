import asyncio
import aiohttp
import json
import yaml
import os
import sys
import random
from tqdm.asyncio import tqdm

# --- CONFIGURATION ---
# The central file containing cookies for all domains
COOKIES_FILE = "cookies.yaml"

# Source definitions with their respective base URLs and keys in cookies.yaml
SOURCES = {
    "berlin": {
        "base_url": "https://berlin.antragsgruen.de/rest",
        "cookie_key": "berlin.antragsgruen.de"
    },
}

# List of convention slugs (url_path) to process
# These will be searched for in all configured sources.
TARGET_SLUGS = [
    "LDK26-1"
]

# Output filename
OUTPUT_FILE = "exported_conventions.yaml"

# Maximum number of concurrent requests per source
MAX_CONCURRENT_REQUESTS = 4
# ---------------------

def load_all_cookies(file_path):
    """Loads all cookies from the central YAML file."""
    try:
        with open(file_path, "r", encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"[-] Error loading cookies from {file_path}: {e}")
        return {}

async def fetch_json(session, url, semaphore, retries=5):
    """Fetches JSON data from a URL, controlled by a semaphore and with retry logic."""
    async with semaphore:
        for i in range(retries):
            # Dynamic timeout: starts at 30s, increases by 30s each retry
            current_timeout = aiohttp.ClientTimeout(total=30 * (i + 1))
            try:
                async with session.get(url, timeout=current_timeout) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 404:
                        return None
                    elif response.status == 429:
                        # Too Many Requests - use long exponential backoff
                        wait_time = (2 ** i) * 10 + random.uniform(0, 5)
                        print(f"\n[!] Rate Limit (429) at {url}. Waiting {wait_time:.1f}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        print(f"[-] Status {response.status} for {url}")
                        return None
            except (asyncio.TimeoutError, aiohttp.ClientError, aiohttp.ServerDisconnectedError) as e:
                # Exponential backoff with jitter: 2, 4, 8, 16, 32 seconds...
                wait_time = (2 ** (i + 1)) + random.uniform(0, 1)
                if i < retries - 1:
                    print(f"[!] {type(e).__name__} at {url}. Retry {i+1}/{retries} in {wait_time:.1f}s (Timeout: {30*(i+1)}s)...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"[-] Error after {retries} attempts at {url}: {type(e).__name__}")
                    return None
            except Exception as e:
                print(f"[-] Unexpected error at {url}: {type(e).__name__} - {str(e)}")
                return None
        return None

async def process_amendment(session, am_link_data, semaphore, prefix=""):
    """Processes a single amendment."""
    # Use url_json from link data if available, otherwise construct it
    url = am_link_data.get("url_json")
    am_id = am_link_data.get("id")
    
    if not url and am_id:
        # Fallback (should not be necessary with correct API usage)
        return None

    data = await fetch_json(session, url, semaphore)
    if not data:
        return None
    
    # Add prefix to ID (except for persons, but this is about the amendment object itself)
    prefixed_am_id = f"{prefix}/{am_id}" if prefix and am_id else am_id

    # Structure according to muster_struktur.yaml
    # Format supporters as a list of strings
    formatted_supporters_am = []
    for s in data.get("supporters", []):
        if isinstance(s, dict):
            name = s.get("name")
            org = s.get("organization")
            if name and org:
                formatted_supporters_am.append(f"{name} ({org})")
            elif name:
                formatted_supporters_am.append(name)
        elif isinstance(s, str):
            formatted_supporters_am.append(s)

    am_struct = {
        "type": data.get("type"),
        "id": prefixed_am_id,
        "prefix": data.get("prefix"),
        "title": data.get("title"),
        "title_with_prefix": data.get("title_with_prefix"),
        "first_line": data.get("first_line"),
        "status_id": data.get("status_id"),
        "status_title": data.get("status_title"),
        "date_published": data.get("date_published"),
        "supporters": formatted_supporters_am,
        "initiators": {
            "type": data.get("initiators", {}).get("type") if isinstance(data.get("initiators"), dict) else None,
            "name": data.get("initiators", {}).get("name") if isinstance(data.get("initiators"), dict) else None,
            "organization": data.get("initiators", {}).get("organization") if isinstance(data.get("initiators"), dict) else None,
        },
        "initiators_html": data.get("initiators_html"),
        "sections": [
            {
                s.get("title", "unnamed"): {
                    "type": s.get("type"),
                    "title": s.get("title"),
                    "html": s.get("html")
                }
            } for s in data.get("sections", [])
        ],
        "proposed_procedure": str(data.get("proposed_procedure")) if data.get("proposed_procedure") else None,
        "url_json": data.get("url_json"),
        "url_html": data.get("url_html")
    }
    return {str(prefixed_am_id): am_struct}


async def process_motion(session, motion_link_data, semaphore, prefix=""):
    """Processes a single motion and its amendments."""
    url = motion_link_data.get("url_json")
    motion_id = motion_link_data.get("id")
    
    if not url:
        return None

    data = await fetch_json(session, url, semaphore)
    if not data:
        return None
    
    # Add prefix to ID
    prefixed_motion_id = f"{prefix}/{motion_id}" if prefix and motion_id else motion_id

    # Fetch amendments
    am_links = data.get("amendment_links") or data.get("amendments") or []
    
    am_tasks = []
    for am in am_links:
        if isinstance(am, dict):
            am_tasks.append(process_amendment(session, am, semaphore, prefix))
    
    # Use tqdm for amendment progress if there are many
    if len(am_tasks) > 5:
        processed_ams = await tqdm.gather(
            *am_tasks, 
            desc=f"        Loading {len(am_tasks)} amendments for motion {motion_id}", 
            leave=False,
            disable=None
        )
    else:
        processed_ams = await asyncio.gather(*am_tasks)
        
    am_list = [am for am in processed_ams if am]

    # Format supporters as a list of strings
    formatted_supporters_mo = []
    for s in data.get("supporters", []):
        if isinstance(s, dict):
            name = s.get("name")
            org = s.get("organization")
            if name and org:
                formatted_supporters_mo.append(f"{name} ({org})")
            elif name:
                formatted_supporters_mo.append(name)
        elif isinstance(s, str):
            formatted_supporters_mo.append(s)

    motion_struct = {
        "type": data.get("type"),
        "id": prefixed_motion_id,
        "agenda_item": data.get("agenda_item"),
        "prefix": data.get("prefix"),
        "title": data.get("title"),
        "title_with_intro": data.get("title_with_intro"),
        "title_with_prefix": data.get("title_with_prefix"),
        "status_id": data.get("status_id"),
        "status_title": data.get("status_title"),
        "date_published": data.get("date_published"),
        "supporters": formatted_supporters_mo,
        "initiators": {
            "type": data.get("initiators", {}).get("type") if isinstance(data.get("initiators"), dict) else None,
            "name": data.get("initiators", {}).get("name") if isinstance(data.get("initiators"), dict) else None,
            "organization": data.get("initiators", {}).get("organization") if isinstance(data.get("initiators"), dict) else None,
        },
        "initiators_html": data.get("initiators_html"),
        "sections": [
            {
                s.get("title", "unnamed"): {
                    "type": s.get("type"),
                    "title": s.get("title"),
                    "html": s.get("html"),
                    "layout_right": s.get("layout_right", False)
                }
            } for s in data.get("sections", [])
        ],
        "proposed_procedure": str(data.get("proposed_procedure")) if data.get("proposed_procedure") else None,
        "amendments": am_list
    }
    return {str(prefixed_motion_id): motion_struct}


async def process_convention(session, conv_info, semaphore, prefix=""):
    """Processes a convention and all motions within it."""
    slug = conv_info.get("url_path")
    print(f"[*] Processing convention: {slug}...")
    
    # Use url_json from convention information
    url = conv_info.get("url_json")
    if not url:
        print(f"[-] No url_json found for {slug}.")
        return None

    conv_data = await fetch_json(session, url, semaphore)
    if not conv_data:
        print(f"[-] Convention details for {slug} could not be loaded.")
        return None
    
    # Add prefix to ID
    prefixed_slug = f"{prefix}/{slug}" if prefix else slug

    # Find motion links
    motion_links = conv_data.get("motion_links") or conv_data.get("motions") or []
    
    motion_tasks = []
    for m in motion_links:
        if isinstance(m, dict):
            motion_tasks.append(process_motion(session, m, semaphore, prefix))
    
    # Use tqdm for motion progress within a convention
    processed_motions = await tqdm.gather(
        *motion_tasks, 
        desc=f"      Loading motions for {slug}", 
        leave=False,
        disable=None
    )
    motion_list = [m for m in processed_motions if m]
    
    print(f"    [+] {len(motion_list)} public motions found in {slug}.")
    
    conv_struct = {
        "title": conv_info.get("title"),
        "title_short": conv_info.get("title_short"),
        "date_published": conv_info.get("date_published"),
        "url_path": prefixed_slug,
        "url_json": conv_info.get("url_json"),
        "url_html": conv_info.get("url_html"),
        "content": {
            "motions": motion_list
        }
    }
    return {str(prefixed_slug): conv_struct}

async def main():
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    # Set headers (User-Agent is often required)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # Load existing data if available to avoid duplicates
    if os.path.exists(OUTPUT_FILE):
        print(f"[*] Loading existing data from {OUTPUT_FILE}...")
        try:
            with open(OUTPUT_FILE, "r", encoding='utf-8') as f:
                final_data = yaml.safe_load(f) or {}
            print(f"[+] {len(final_data)} conventions already present in local file.")
        except Exception as e:
            print(f"[-] Error loading {OUTPUT_FILE}: {e}")
            final_data = {}
    else:
        final_data = {}
    
    # Load all cookies at once
    all_cookies_data = load_all_cookies(COOKIES_FILE)
    
    # Iterate over all configured sources
    for source_name, config in SOURCES.items():
        base_url = config["base_url"]
        cookie_key = config["cookie_key"]
        
        print(f"\n[***] Processing source: {source_name} ({base_url}) [***]")
        
        # Extract cookies for this specific source
        cookies = all_cookies_data.get(cookie_key, {})
        if not cookies:
            print(f"[!] Warning: No cookies found for {cookie_key} in {COOKIES_FILE}.")
        
        async with aiohttp.ClientSession(cookies=cookies, headers=headers) as session:
            # 1. Fetch all available conventions from this source
            print(f"[*] Fetching convention list from {base_url}...")
            all_conventions = await fetch_json(session, base_url, semaphore)
            
            if not all_conventions or not isinstance(all_conventions, list):
                print(f"[-] Convention list from {source_name} could not be loaded.")
                continue

            # 2. Filter only target slugs present in this source
            target_convs = [c for c in all_conventions if c.get("url_path") in TARGET_SLUGS]
            
            if not target_convs:
                print(f"[-] None of the target slugs found in {source_name}.")
                continue

            # 3. Process conventions for this source
            for conv_link in tqdm(target_convs, desc=f"Progress {source_name}"):
                 slug = conv_link.get("url_path")
                 if not slug:
                     continue
                 
                 # Check if this convention has already been loaded (with source as prefix)
                 prefixed_slug = f"{source_name}/{slug}" if source_name else slug
                 if prefixed_slug in final_data:
                     continue
                     
                 result = await process_convention(session, conv_link, semaphore, source_name)
                 if result:
                     final_data.update(result)
        
    # 4. Save as YAML
    if final_data:
        print(f"\n[*] Saving a total of {len(final_data)} conventions to {OUTPUT_FILE}...")
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(final_data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
        print(f"[+] Done! Data has been saved to {OUTPUT_FILE}.")
    else:
        print("\n[-] No data found to save.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[!] Canceled by user.")

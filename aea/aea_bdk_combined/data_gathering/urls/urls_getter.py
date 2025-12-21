import os
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

def extract_amendment_urls(input_filename, output_filename, base_url):
    # Prüfen, ob die Datei existiert
    if not os.path.exists(input_filename):
        print(f"Fehler: Die Datei '{input_filename}' wurde nicht gefunden.")
        return

    print(f"Lese Datei: {input_filename}...")
    
    # HTML Datei einlesen
    with open(input_filename, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # HTML parsen
    soup = BeautifulSoup(html_content, 'html.parser')

    # Liste für die URLs
    urls = []

    # In Antragsgrün haben Änderungsanträge im Link meist die Klasse "amendmentTitle"
    # Wir suchen alle <a> Tags mit dieser Klasse
    print("Suche nach Änderungsanträgen...")
    amendment_links = soup.find_all('a', class_='amendmentTitle')

    for link in amendment_links:
        href = link.get('href')
        if href:
            # Wenn der Link relativ ist (fängt mit / an), fügen wir die Base-URL hinzu
            if href.startswith('/'):
                full_url = base_url + href
            elif href.startswith('http'):
                full_url = href
            else:
                # Fallback für andere relative Links ohne führenden Slash
                full_url = base_url + '/' + href.lstrip('/')
            
            urls.append(full_url)

    # Duplikate entfernen (optional, aber sauberer)
    unique_urls = list(dict.fromkeys(urls))

    # In Datei speichern
    print(f"Speichere {len(unique_urls)} URLs in '{output_filename}'...")
    with open(output_filename, 'w', encoding='utf-8') as f:
        for url in unique_urls:
            f.write(url + '\n')

    print("Fertig!")

if __name__ == "__main__":
    # Konfiguration
    input_filenames = ['44_bdk.html', '45_bdk.html', '46_bdk.html', '47_bdk.html', '48_bdk.html', '49_bdk.html', '50_bdk.html', '51_bdk.html']
    output_filenames = ['44_aenderungsantraege_urls.txt', '45_aenderungsantraege_urls.txt', '46_aenderungsantraege_urls.txt', '47_aenderungsantraege_urls.txt', '48_aenderungsantraege_urls.txt', '49_aenderungsantraege_urls.txt', '50_aenderungsantraege_urls.txt', '51_aenderungsantraege_urls.txt'] 
    base_urls = ['https://antraege.gruene.de', 'https://antraege.gruene.de', 'https://antraege.gruene.de', 'https://antraege.gruene.de', 'https://antraege.gruene.de', 'https://antraege.gruene.de', 'https://antraege.gruene.de', 'https://antraege.gruene.de']
    with ThreadPoolExecutor() as executor:
        executor.map(extract_amendment_urls, input_filenames, output_filenames, base_urls)

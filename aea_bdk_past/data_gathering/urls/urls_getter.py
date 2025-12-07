import os
from bs4 import BeautifulSoup

# Konfiguration
input_filename = '51. Bundesdelegiertenkonferenz Hannover (Antragsgrün).html'
output_filename = 'aenderungsantraege_urls.txt'
base_url = 'https://antraege.gruene.de'

def extract_amendment_urls():
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
    extract_amendment_urls()
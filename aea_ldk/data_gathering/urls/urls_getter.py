import os
from bs4 import BeautifulSoup

# KONFIGURATION
# Hier den Dateinamen der HTML-Datei eintragen
input_filename = "LDK am 30. November 2024 (Antragsgrün).html"
output_filename = "aenderungsantraege_urls.txt"
base_url = "https://berlin.antragsgruen.de"

def extract_amendment_urls():
    # Prüfen, ob die Datei existiert
    if not os.path.exists(input_filename):
        print(f"Fehler: Die Datei '{input_filename}' wurde nicht gefunden.")
        return

    print(f"Lese Datei: {input_filename}...")
    
    with open(input_filename, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Ein Set verwenden, um Duplikate automatisch zu entfernen
    full_urls = set()

    # Strategie: Wir suchen alle <ul> Elemente mit der Klasse 'amendments'.
    # In der bereitgestellten HTML befinden sich alle Änderungsanträge (sowohl im Hauptteil
    # als auch in der Sidebar) in Listen mit dieser Klasse.
    amendment_lists = soup.find_all('ul', class_='amendments')

    print(f"{len(amendment_lists)} Bereiche mit Änderungsanträgen gefunden.")

    for ul in amendment_lists:
        # Alle Links (<a> Tags) innerhalb dieser Listen finden
        links = ul.find_all('a')
        for link in links:
            href = link.get('href')
            
            # Nur verarbeiten, wenn ein href existiert und nicht leer ist
            if href:
                # Manchmal sind 'privateCommentHolder' spans leer, wir wollen nur echte Links
                # Falls der Link relativ ist (fängt mit / an), Basis-URL davor setzen
                if href.startswith('/'):
                    full_url = base_url + href
                elif href.startswith('http'):
                    full_url = href
                else:
                    # Ignorieren falls es nur #anker oder javascript sind
                    continue
                
                # Wir filtern rein sicherheitshalber PDF-Direktlinks aus, 
                # falls wir nur die Webansicht wollen. (Optional, hier drin gelassen)
                full_urls.add(full_url)

    # Sortieren für eine saubere Liste
    sorted_urls = sorted(list(full_urls))

    # In Datei schreiben
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            for url in sorted_urls:
                f.write(url + "\n")
        print(f"Erfolg! {len(sorted_urls)} URLs wurden in '{output_filename}' gespeichert.")
    except Exception as e:
        print(f"Fehler beim Schreiben der Datei: {e}")

if __name__ == "__main__":
    extract_amendment_urls()
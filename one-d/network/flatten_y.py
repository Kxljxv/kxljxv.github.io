import networkx as nx
import sys
import os

def flatten_gexf_y(input_path):
    """
    Liest eine GEXF-Datei ein und setzt alle Y-Koordinaten der Knoten auf 0.
    Speichert das Ergebnis in einer neuen Datei mit dem Suffix '_flat'.
    """
    if not os.path.exists(input_path):
        print(f"Fehler: Datei '{input_path}' nicht gefunden.")
        return

    print(f"Lese '{input_path}' ein...")
    # GEXF mit Attributen einlesen
    try:
        # Wir nutzen nx.read_gexf, um die Struktur und viz-Daten zu erhalten
        G = nx.read_gexf(input_path)
    except Exception as e:
        print(f"Fehler beim Lesen der GEXF: {e}")
        return

    nodes_processed = 0
    for node_id in G.nodes:
        # viz-Daten abrufen (enthalten oft die Position)
        viz = G.nodes[node_id].get('viz', {})
        if isinstance(viz, dict) and 'position' in viz:
            # Setze Y auf 0.0
            viz['position']['y'] = 0.0
            nodes_processed += 1
        
        # Falls Positionen als direkte Attribute vorliegen (manchmal bei anderen Exporten)
        if 'y' in G.nodes[node_id]:
            G.nodes[node_id]['y'] = 0.0
            nodes_processed += 1

    # Ausgabepfad generieren
    base, ext = os.path.splitext(input_path)
    output_path = f"{base}_flat{ext}"

    print(f"Setze Y=0 für {nodes_processed} Knoten...")
    
    # Datei speichern
    try:
        nx.write_gexf(G, output_path)
        print(f"Erfolgreich gespeichert unter: {output_path}")
    except Exception as e:
        print(f"Fehler beim Speichern der GEXF: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        flatten_gexf_y(sys.argv[1])
    else:
        # Standardmäßig nach einer bekannten Datei suchen, falls kein Argument übergeben wurde
        default_file = "simuliertes-netzwerk-900.gexf"
        if os.path.exists(default_file):
            flatten_gexf_y(default_file)
        else:
            print("Verwendung: python flatten_y.py <pfad_zur_gexf_datei>")

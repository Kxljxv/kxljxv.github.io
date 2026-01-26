import networkx as nx
import pandas as pd
import os

def convert_gexf_to_cosmograph(input_file):
    # 1. GEXF Datei einlesen
    if not os.path.exists(input_file):
        print(f"Fehler: Datei '{input_file}' nicht gefunden.")
        return

    print(f"Lese {input_file} ein...")
    G = nx.read_gexf(input_file)

    # 2. Knoten (Nodes) extrahieren
    nodes_data = []
    for node_id, attrs in G.nodes(data=True):
        # Wir erstellen ein Dictionary mit der ID und allen Attributen
        node_dict = {"id": node_id}
        node_dict.update(attrs)
        nodes_data.append(node_dict)
    
    nodes_df = pd.DataFrame(nodes_data)

    # 3. Kanten (Links) extrahieren
    links_data = []
    for source, target, attrs in G.edges(data=True):
        # Cosmograph benötigt 'source' und 'target'
        link_dict = {"source": source, "target": target}
        link_dict.update(attrs)
        links_data.append(link_dict)
    
    links_df = pd.DataFrame(links_data)

    # 4. Export als CSV
    nodes_filename = "cosmo_nodes.csv"
    links_filename = "cosmo_links.csv"
    
    nodes_df.to_csv(nodes_filename, index=False)
    links_df.to_csv(links_filename, index=False)

    print(f"Erfolgreich konvertiert!")
    print(f"-> Knoten gespeichert in: {nodes_filename} ({len(nodes_df)} Zeilen)")
    print(f"-> Kanten gespeichert in: {links_filename} ({len(links_df)} Zeilen)")

# Beispielaufruf (Ersetze 'deine_datei.gexf' mit deinem Dateinamen)
if __name__ == "__main__":
    convert_gexf_to_cosmograph("simuliertes-netzwerk-900.gexf")
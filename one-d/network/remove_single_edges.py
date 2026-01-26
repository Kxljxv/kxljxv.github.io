import networkx as nx
import os

# --- KONFIGURATION ---
INPUT_FILE = "berlin_amendments.gexf"
OUTPUT_FILE = "netzwerk.gexf"

def remove_single_connection_nodes():
    if not os.path.exists(INPUT_FILE):
        print(f"[-] Fehler: {INPUT_FILE} nicht gefunden.")
        return

    print(f"[*] Lade {INPUT_FILE}...")
    G = nx.read_gexf(INPUT_FILE)
    
    initial_node_count = G.number_of_nodes()
    
    # Identifiziere Knoten mit Grad 1
    # Wir erstellen eine Liste, da wir den Graphen während der Iteration nicht verändern sollten
    nodes_to_remove = [node for node, degree in dict(G.degree()).items() if degree == 1]
    
    if not nodes_to_remove:
        print("[*] Keine Knoten mit nur einer Verbindung gefunden.")
        return

    print(f"[*] Entferne {len(nodes_to_remove)} Knoten...")
    G.remove_nodes_from(nodes_to_remove)
    
    final_node_count = G.number_of_nodes()
    
    print(f"[*] Speichere Ergebnis in {OUTPUT_FILE}...")
    nx.write_gexf(G, OUTPUT_FILE)
    
    print(f"[+] Fertig! Knoten reduziert von {initial_node_count} auf {final_node_count}.")

if __name__ == "__main__":
    remove_single_connection_nodes()

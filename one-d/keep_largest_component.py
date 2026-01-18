import json
import collections
import os

def find_largest_component(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    nodes = data.get('nodes', [])
    links = data.get('links', [])

    if not nodes:
        print("Keine Knoten gefunden.")
        return

    # Adjazenzliste aufbauen
    adj = collections.defaultdict(list)
    for link in links:
        source = link['source']
        target = link['target']
        adj[source].append(target)
        adj[target].append(source)

    visited = set()
    components = []

    for node in nodes:
        node_id = node['id']
        if node_id not in visited:
            # Neue Komponente gefunden (BFS)
            component = []
            queue = collections.deque([node_id])
            visited.add(node_id)
            while queue:
                u = queue.popleft()
                component.append(u)
                for v in adj[u]:
                    if v not in visited:
                        visited.add(v)
                        queue.append(v)
            components.append(component)

    if not components:
        print("Keine Komponenten gefunden.")
        return

    # Größte Komponente finden
    largest_component_nodes = max(components, key=len)
    largest_component_set = set(largest_component_nodes)

    print(f"Anzahl Komponenten: {len(components)}")
    print(f"Größte Komponente: {len(largest_component_nodes)} Knoten (von insgesamt {len(nodes)})")

    # Neue Knoten und Links filtern
    new_nodes = [n for n in nodes if n['id'] in largest_component_set]
    new_links = [l for l in links if l['source'] in largest_component_set and l['target'] in largest_component_set]

    new_data = {
        "nodes": new_nodes,
        "links": new_links
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, indent=2, ensure_ascii=False)
    
    print(f"Daten erfolgreich in {output_file} gespeichert.")

if __name__ == "__main__":
    path = r'c:\Users\kolja\Desktop\ldk-26-1-schnell\one-dimensional\network_data.json'
    find_largest_component(path, path)

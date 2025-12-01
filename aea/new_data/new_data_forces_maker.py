import json
import os
import math

def load_graph_data(path="graph_data.json"):
    """
    Liest graph_data.json ein und gibt sie als Dictionary zurück.

    Die Struktur der zurückgegebenen Daten sieht folgendermaßen aus:

    {
      "motions": [
        {
          "code": "VR-01-025",              # Antragscode
          "applicant": ["Name", "KV XY"],   # Antragsteller*in (oder None)
          "supporters": [                   # Liste von Supporter*innen
            ["Name 1", "KV XY"],
            ["Name 2", "KV AB"],
            ...
          ],
          "url": "https://..."              # Quell-URL des Antrags
        },
        ...
      ],
      "metadata": {
        "generated_at": "2024-03-17T10:15:00Z"
      }
    }

    Rückgabewert:
        dict – das vollständige oben beschriebene JSON
    """

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return data


def list_unique_supporters_applicants():

    """
    Listet alle einzigartigen Supporter*innen oder Antragssteller*innen auf.

    Struktur:
    {(Name, KV XY), (Name 2, KV AB), ...}
    """

    data = load_graph_data()

    unique_supporters_applicants = set()
    for motion in data["motions"]:
        supporters = motion.get("supporters", [])
        if len(supporters) > 1:
            for supporter in supporters:
                # Füge Supporter*innen hinzu
                unique_supporters_applicants.add((supporter[0], supporter[1]))
    
    # Füge Antragsteller*innen hinzu
    for motion in data["motions"]:
        supporters = motion.get("supporters", [])
        applicant = motion.get("applicant", None)
        if len(supporters) > 1:
            if applicant:
                unique_supporters_applicants.add((applicant[0], applicant[1]))
    
    return unique_supporters_applicants

print(list_unique_supporters_applicants())

json_data = load_graph_data()


out_path = os.path.join(os.getcwd(), 'list_unique_supporters_applicants.txt')
with open(out_path, 'w', encoding='utf-8') as f:
    for item in list_unique_supporters_applicants():
        f.write(f"{item[0]} | {item[1]}\n")


amendments = json_data["motions"]
unique_supporters_applicants = list_unique_supporters_applicants()
forces_dict = {}


for amendment in amendments:
    amendment_id = amendment["code"]
    applicant = tuple(amendment["applicant"])
    supporters = set(tuple(s) for s in amendment["supporters"])

    amendment_links_dict = {}

    for unique_supporter_applicant in unique_supporters_applicants:
        if unique_supporter_applicant == applicant:
            amendment_links_dict[unique_supporter_applicant] = 2
        elif unique_supporter_applicant in supporters:
            amendment_links_dict[unique_supporter_applicant] = 1
        else:
            amendment_links_dict[unique_supporter_applicant] = 0

    forces_dict[amendment_id] = amendment_links_dict




supporters_applicants_count = {}

for links_dict in forces_dict.values():
    """
    calculates, how many amendments a supporter/applicant supports and how many amendments a supporter/applicant opposes. Has the supporter/applicant as Key and then a tuple as Value. The tuple has the format (supports, opposes).
    """

    for supporter_applicant, force in links_dict.items():
        if supporter_applicant not in supporters_applicants_count:
            supporters_applicants_count[supporter_applicant] = (0, 0)
        if(force == 1):
            supporters_applicants_count[supporter_applicant] = (supporters_applicants_count[supporter_applicant][0] + 1, supporters_applicants_count[supporter_applicant][1])
        elif(force == 2):
            supporters_applicants_count[supporter_applicant] = (supporters_applicants_count[supporter_applicant][0], supporters_applicants_count[supporter_applicant][1] + 1)


final_forces_dict = {}

for amendment_id, links_dict in forces_dict.items():

    final_forces_dict_amendment = {}
    for supporter_applicant, force in links_dict.items():
        if force > 0:
            supported_opposed_count = supporters_applicants_count[supporter_applicant]
            final_forces_dict_amendment[supporter_applicant] = supported_opposed_count[0] ** (1/3) + (supported_opposed_count[1] ** (1/1.75))/1.5
        else: 
            supported_opposed_count = supporters_applicants_count[supporter_applicant]
            final_forces_dict_amendment[supporter_applicant] = -0.05 * (supported_opposed_count[0] ** (1/3) + (supported_opposed_count[1] ** (1/1.75))/1.5)


    final_forces_dict.update({amendment_id:final_forces_dict_amendment})

print(final_forces_dict)



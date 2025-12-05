import requests
from bs4 import BeautifulSoup
import re
import json
from typing import Dict, Any

def txt_to_list(txt: str) -> list[str]:
    """
    Converts a string of text to a list of strings, where each string is a line from the text.
    """
    with open(txt, "r", encoding="utf-8") as file:
        txt = file.read()
    return txt.splitlines()



def extract_list_from_section(url: str) -> list[str]:
    """
    Fetches a webpage and extracts the text content of all <li> items
    from the <section> that has class="supporters" and id="supporters".
    
    Returns a list of strings.
    """
    
    response = requests.get(url)
    response.raise_for_status()  # Ensure the request was successful

    soup = BeautifulSoup(response.text, "html.parser")

    # Find the target section
    section = soup.find("section", {"class": "supporters", "id": "supporters"})
    if not section:
        return []  # If not found, return an empty list

    # Find all list items inside the section
    items = section.find_all("li")

    # Extract clean text from each <li>

    # Extract visible text, removing parentheses or additional info
    clean_names = []
    for name in items:
        full_text = name.get_text(" ", strip=True)
        clean_name = re.split(r"\s*\(", full_text)[0].strip()
        clean_names.append(clean_name)

    return clean_names

def extract_heading_from_section(url: str) -> list[str]:
    """
    Fetches a webpage and extracts the text content of all <h1> items
    from the <section> that has class="primaryHeader".
    
    Returns a list of strings.
    """
    
    response = requests.get(url)
    response.raise_for_status()  # Ensure the request was successful

    soup = BeautifulSoup(response.text, "html.parser")

    # Find the target div
    div = soup.find("div", {"class": "primaryHeader"})
    if not div:
        print('empty div')
        return []  # If not found, return an empty list
        
        

    # Find all list items inside the div
    items = div.find_all("h1")

    # Extract clean text from each <h1>
    return [item.get_text(strip=True) for item in items]

def extract_applicant_name(url: str) -> str | None:
    """
    Fetches the webpage and extracts the applicant's name from the motionDataTable.
    Returns a clean name string or None if not found.
    """

    response = requests.get(url)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Find the data table
    table = soup.find("table", {"class": "motionDataTable"})
    if not table:
        return None

    # Find the row containing the applicant entry
    applicant_row = table.find("th", string=lambda t: t and "Antragsteller*in" in t)
    if not applicant_row:
        return None

    # The name is inside the adjacent <td>
    applicant_cell = applicant_row.find_next("td")
    if not applicant_cell:
        return None

    # Extract visible text, removing parentheses or additional info
    full_text = applicant_cell.get_text(" ", strip=True)
    clean_name = re.split(r"\s*\(", full_text)[0].strip()

    return clean_name

def save_dict_to_json(data: Dict[str, Any], filename: str) -> None:
    """
    Saves a Python dictionary to a JSON file.

    Args:
        data (dict): The dictionary to save.
        filename (str): The path/name of the file (e.g., 'data.json').
    """
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Success: Data saved to {filename}")
    except IOError as e:
        print(f"Error: Could not write to file {filename}. Reason: {e}")
    except TypeError as e:
        print(f"Error: Data contains non-serializable objects. Reason: {e}")


url_txts = [
    'urls/LA25-4.txt',
    'urls/LA25-3.txt',
]

url_lists = [txt_to_list(txt) for txt in url_txts]

database = {}

print(url_lists)
for url_list in url_lists:
    for url in url_list:
        url_data = {}

        id_session = re.split("/",(re.split("https://berlin.antragsgruen.de/", url)[1]))[0]
        
        heading = extract_heading_from_section(url)

        try:
            id_heading = re.split(":", heading[0])[0]
            id_heading = re.split(" zu ", id_heading)[0]
        except:
            id_heading = re.split(":", heading[0])[0]

        print(id_heading)
            
        application_id = "-".join([id_session, id_heading])

        applicant = extract_applicant_name(url)

        supporters = extract_list_from_section(url)
        

        print(heading)
        print(applicant)
        print(supporters)
        print(url)

        url_data["application_id"] = application_id
        url_data["heading"] = heading
        url_data["applicant"] = applicant
        url_data["supporters"] = supporters
        url_data["url"] = url
        database[application_id] = url_data


print(database)
save_dict_to_json(database, "la_data.json")





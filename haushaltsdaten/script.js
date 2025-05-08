// Utility function to fetch JSON files
async function fetchJSON(path) {
    try {
        console.log(`Fetching JSON file: ${path}`);
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching JSON file (${path}):`, error);
        return null;
    }
}

// Utility function to fetch and parse YAML files
async function fetchYAML(path) {
    try {
        console.log(`Fetching YAML file: ${path}`);
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        const text = await response.text();
        const yamlData = jsyaml.load(text);
        console.log(`Parsed YAML data from ${path}:`, yamlData);
        return yamlData;
    } catch (error) {
        console.error(`Error fetching or parsing YAML file (${path}):`, error);
        return null;
    }
}

// Function to render the treemap
async function renderTreemap(path = '') {
    const treemapContainer = document.getElementById('treemap');
    treemapContainer.innerHTML = '';
    console.log(`Rendering treemap for path: ${path}`);

    // Ensure the path ends with a slash for consistent directory structure
    if (path && !path.endsWith('/')) {
        path += '/';
    }

    const directoryData = await fetchJSON(`${path}directory.json`);
    if (!directoryData) {
        console.warn('Failed to fetch directory data.');
        treemapContainer.textContent = 'Failed to load data.';
        return;
    }

    const { files, subdirectories } = directoryData;
    const yamlFiles = files.filter(file => file.endsWith('.yaml'));
    const data = [];

    for (const file of yamlFiles) {
        const yamlData = await fetchYAML(`${path}${file}`);
        if (yamlData) {
            const betrag = parseFloat(yamlData.Betrag); // Convert 'Betrag' to a number
            if (!isNaN(betrag)) {
                // Use the actual folder name (e.g., `30`, `31`) instead of Bereichsbezeichnung
                const folderName = file.replace('.yaml', '');
                data.push({
                    name: yamlData.Bereichsbezeichnung || folderName,
                    betrag: betrag,
                    hasFolder: subdirectories.includes(folderName)
                });
            } else {
                console.warn(`YAML file ${file} has an invalid 'Betrag' field:`, yamlData.Betrag);
            }
        }
    }

    if (data.length === 0) {
        console.warn('No valid data found to render the treemap.');
        treemapContainer.textContent = 'No valid data available to display.';
        return;
    }

    console.log('Processed data for treemap:', data);

    const totalBetrag = data.reduce((sum, item) => sum + item.betrag, 0);
    const containerWidth = treemapContainer.clientWidth;
    const containerHeight = treemapContainer.clientHeight;

    for (const item of data) {
        const areaRatio = item.betrag / totalBetrag;
        const area = containerWidth * containerHeight * areaRatio;
        const width = Math.sqrt(area * (containerWidth / containerHeight));
        const height = area / width;

        const div = document.createElement('div');
        div.className = 'treemap-item';
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        div.textContent = item.name;

        if (item.hasFolder) {
            div.addEventListener('click', () => {
                console.log(`Navigating into folder: ${item.name}`);
                renderTreemap(`${path}${item.name}`); // Use correct folder name for navigation
            });
        } else {
            div.style.cursor = 'default';
        }

        treemapContainer.appendChild(div);
    }
}

// Initialize the treemap
console.log('Initializing treemap visualization...');
renderTreemap();

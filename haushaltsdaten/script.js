// Utility function to fetch and parse YAML files
async function fetchYAML(path) {
    try {
        console.log(`Fetching YAML file: ${path}`);
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        const text = await response.text();
        return jsyaml.load(text);
    } catch (error) {
        console.error(`Error fetching YAML file (${path}):`, error);
        return null;
    }
}

// Function to get the list of YAML files and corresponding folders
async function getDirectoryData(path) {
    try {
        console.log(`Fetching directory data: ${path}`);
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch directory listing at ${path}`);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = Array.from(doc.querySelectorAll('a'))
            .map(link => link.getAttribute('href'))
            .filter(href => href && href !== '../');

        const yamlFiles = links.filter(name => name.endsWith('.yaml'));
        const folders = links.filter(name => !name.endsWith('.yaml') && name.endsWith('/'));

        console.log(`Found YAML files:`, yamlFiles);
        console.log(`Found folders:`, folders);

        return { yamlFiles, folders };
    } catch (error) {
        console.error(`Error fetching directory data (${path}):`, error);
        return { yamlFiles: [], folders: [] };
    }
}

// Function to render the treemap
async function renderTreemap(path = '') {
    const treemapContainer = document.getElementById('treemap');
    treemapContainer.innerHTML = '';
    console.log(`Rendering treemap for path: ${path}`);

    const { yamlFiles, folders } = await getDirectoryData(path);
    const data = [];

    for (const file of yamlFiles) {
        const yamlData = await fetchYAML(`${path}${file}`);
        if (yamlData && typeof yamlData.Betrag === 'number') {
            data.push({
                name: file.replace('.yaml', ''),
                betrag: yamlData.Betrag,
                hasFolder: folders.includes(`${file.replace('.yaml', '')}/`)
            });
        }
    }

    if (data.length === 0) {
        console.warn('No valid data found to render the treemap.');
        treemapContainer.textContent = 'No data available to display.';
        return;
    }

    console.log('Processed data for treemap:', data);

    const totalBetrag = data.reduce((sum, item) => sum + item.betrag, 0);
    const containerWidth = treemapContainer.clientWidth;
    const containerHeight = treemapContainer.clientHeight;

    let rowHeight = 0;

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
                renderTreemap(`${path}${item.name}/`);
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

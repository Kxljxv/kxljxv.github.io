// Utility function to fetch and parse YAML files
async function fetchYAML(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        const text = await response.text();
        return jsyaml.load(text);
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Function to get the list of YAML files and corresponding folders
async function getDirectoryData(path) {
    try {
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

        return { yamlFiles, folders };
    } catch (error) {
        console.error(error);
        return { yamlFiles: [], folders: [] };
    }
}

// Function to render the treemap
async function renderTreemap(path = '') {
    const treemapContainer = document.getElementById('treemap');
    treemapContainer.innerHTML = '';

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

    const totalBetrag = data.reduce((sum, item) => sum + item.betrag, 0);
    const containerWidth = treemapContainer.clientWidth;
    const containerHeight = treemapContainer.clientHeight;

    let x = 0;
    let y = 0;
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
                renderTreemap(`${path}${item.name}/`);
            });
        } else {
            div.style.cursor = 'default';
        }

        treemapContainer.appendChild(div);
    }
}

// Initialize the treemap
renderTreemap();

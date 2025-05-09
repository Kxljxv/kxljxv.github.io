const LABEL_PRIORITY = [
    "Titelbezeichnung",
    "Gruppenbezeichnung",
    "Obergruppenbezeichnung",
    "Kapitelbezeichnung",
    "Einzelplanbezeichnung",
    "Bereichsbezeichnung"
];

function pickLabel(yamlObj) {
    for (const key of LABEL_PRIORITY) {
        if (yamlObj[key]) return yamlObj[key];
    }
    return "Unbenannt";
}

async function fetchJSON(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching JSON file (${path}):`, error);
        return null;
    }
}

async function fetchYAML(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        const text = await response.text();
        return jsyaml.load(text);
    } catch (error) {
        console.error(`Error fetching or parsing YAML file (${path}):`, error);
        return null;
    }
}

const navStack = [];

function showBackButton() {
    const btn = document.getElementById("back-btn");
    btn.style.display = navStack.length > 0 ? "block" : "none";
}

function formatYamlAttributes(yaml) {
    return Object.entries(yaml)
        .map(([k, v]) => `<b>${k}</b>: ${v}`)
        .join('<br/>');
}

function showTooltip(html, x, y) {
    const tooltip = document.getElementById('treemap-tooltip');
    tooltip.innerHTML = html;
    tooltip.style.opacity = 1;
    tooltip.style.left = x + 12 + "px"; // Add padding
    tooltip.style.top = y + 12 + "px";
}

function hideTooltip() {
    const tooltip = document.getElementById('treemap-tooltip');
    tooltip.style.opacity = 0;
}

async function renderTreemap(path = "") {
    const container = document.getElementById("treemap");
    container.innerHTML = "";
    showBackButton();

    const dirData = await fetchJSON(`${path}directory.json`);
    if (!dirData) {
        container.textContent = "Fehler beim Laden der Daten.";
        return;
    }

    const entries = [];
    for (const file of dirData.files.filter(f => f.endsWith(".yaml"))) {
        const yaml = await fetchYAML(`${path}${file}`);
        if (yaml && yaml.Betrag) {
            const betrag = parseFloat(yaml.Betrag);
            if (!isNaN(betrag)) {
                entries.push({
                    name: pickLabel(yaml),
                    betrag: betrag,
                    folderName: file.replace(".yaml", ""),
                    hasFolder: dirData.subdirectories.includes(file.replace(".yaml", "")),
                    yaml: yaml
                });
            }
        }
    }

    if (entries.length === 0) {
        container.textContent = "Keine gültigen Daten gefunden.";
        return;
    }

    entries.sort((a, b) => b.betrag - a.betrag);

    const root = d3.hierarchy({children: entries}).sum(d => d.betrag);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    d3.treemap()
        .size([width, height])
        .paddingOuter(0) // No gaps
        .paddingInner(0) // No gaps
        (root);

    for (const node of root.leaves()) {
        const d = node.data;
        const div = document.createElement("div");
        div.className = "treemap-rect" + (d.hasFolder ? "" : " no-folder");
        div.style.left = `${node.x0}px`;
        div.style.top = `${node.y0}px`;
        div.style.width = `${node.x1 - node.x0}px`;
        div.style.height = `${node.y1 - node.y0}px`;
        div.textContent = d.name;

        div.addEventListener('mouseenter', (e) => {
            showTooltip(formatYamlAttributes(d.yaml), e.clientX, e.clientY);
        });
        div.addEventListener('mousemove', (e) => {
            showTooltip(formatYamlAttributes(d.yaml), e.clientX, e.clientY);
        });
        div.addEventListener('mouseleave', hideTooltip);

        if (d.hasFolder) {
            div.addEventListener('click', () => {
                navStack.push(path);
                renderTreemap(`${path}${d.folderName}/`);
            });
        }

        container.appendChild(div);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("back-btn");
    btn.onclick = () => {
        if (navStack.length > 0) {
            const prevPath = navStack.pop();
            renderTreemap(prevPath);
        }
    };
    renderTreemap();
});

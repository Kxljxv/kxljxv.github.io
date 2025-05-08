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
    // Place tooltip, prevent overflow
    const pad = 12;
    tooltip.style.left = x + pad + "px";
    tooltip.style.top = y + pad + "px";
    setTimeout(() => { // adjust if needed after rendering
        const rect = tooltip.getBoundingClientRect();
        let left = x + pad, top = y + pad;
        if (left + rect.width > window.innerWidth) left = x - rect.width - pad;
        if (top + rect.height > window.innerHeight) top = y - rect.height - pad;
        tooltip.style.left = Math.max(left, 0) + "px";
        tooltip.style.top = Math.max(top, 0) + "px";
    }, 0);
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

    // Gather data
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

    // Sort descending by betrag (largest first)
    entries.sort((a, b) => b.betrag - a.betrag);

    // D3 Treemap: Build hierarchy
    const root = d3.hierarchy({children: entries})
        .sum(d => d.betrag);

    // Get container size
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // NO paddings for gapless layout
    d3.treemap()
        .size([width, height])
        .paddingOuter(0)
        .paddingInner(0)
        (root);

    // Mirror horizontally and vertically for biggest upper-right
    for (const node of root.leaves()) {
        const d = node.data;
        const x = width - node.x1;
        const y = height - node.y1;
        const w = node.x1 - node.x0;
        const h = node.y1 - node.y0;

        const div = document.createElement("div");
        div.className = "treemap-rect" + (d.hasFolder ? "" : " no-folder");
        div.style.left = `${x}px`;
        div.style.top = `${y}px`;
        div.style.width = `${w}px`;
        div.style.height = `${h}px`;
        div.textContent = d.name;

        // Tooltip logic
        div.addEventListener('mouseenter', (e) => {
            showTooltip(formatYamlAttributes(d.yaml), e.clientX, e.clientY);
        });
        div.addEventListener('mousemove', (e) => {
            showTooltip(formatYamlAttributes(d.yaml), e.clientX, e.clientY);
        });
        div.addEventListener('mouseleave', hideTooltip);

        if (d.hasFolder) {
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                navStack.push(path);
                renderTreemap(`${path}${d.folderName}/`);
            });
        }

        container.appendChild(div);
    }
}

// Back button logic
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

// Hide tooltip when scrolling/resizing
window.addEventListener('scroll', hideTooltip);
window.addEventListener('resize', hideTooltip);

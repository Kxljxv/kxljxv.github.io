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
let chart;

function showBackButton() {
    const btn = document.getElementById("back-btn");
    btn.style.display = navStack.length > 0 ? "block" : "none";
}

async function renderTreemap(path = "") {
    const dirData = await fetchJSON(`${path}directory.json`);
    if (!dirData) {
        alert("Failed to load data.");
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
                    value: betrag,
                    yaml: yaml,
                    folderName: file.replace(".yaml", ""),
                    hasFolder: dirData.subdirectories.includes(file.replace(".yaml", ""))
                });
            }
        }
    }

    if (entries.length === 0) {
        alert("No valid data found.");
        return;
    }

    // Map data for amCharts
    const chartData = entries.map(entry => ({
        name: entry.name,
        value: entry.value,
        yaml: entry.yaml,
        folderName: entry.folderName,
        hasFolder: entry.hasFolder
    }));

    // Render the treemap
    renderChart(chartData, path);
}

function renderChart(data, path) {
    if (chart) {
        chart.dispose(); // Dispose existing chart
    }

    showBackButton();

    am5.ready(() => {
        const root = am5.Root.new("chartdiv");
        chart = root.container.children.push(
            am5hierarchy.Treemap.new(root, {
                singleBranchOnly: false,
                downDepth: 1,
                initialDepth: 1,
                valueField: "value",
                categoryField: "name",
                childDataField: "children",
                tooltip: am5.Tooltip.new(root, {
                    labelText: "{name}\n{yaml}"
                })
            })
        );

        chart.data.setAll(data);

        // Tooltip customization
        chart.get("tooltip").label.setAll({
            html: true,
            text: ""
        });

        // Add click events for navigation
        chart.children.each((series) => {
            series.data.each((node) => {
                if (node.dataItem.dataContext.hasFolder) {
                    series.dataItem.events.on("click", () => {
                        navStack.push(path);
                        renderTreemap(`${path}${node.dataItem.dataContext.folderName}/`);
                    });
                }
            });
        });
    });
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

// script.js
var map = null;
var geojsonData2021 = null;
var geojsonData2025 = null;
var electionData2021 = null;
var electionData2025 = null;
var currentGeojsonData = null;
var currentElectionData = null;
var currentYear = '2025'; // Default year
var currentDataField = 'Wahlbeteiligung'; // Default data field
var lastClickedFeatureId = null;
var resultChart = null;

// Party display names and colors
var partyDisplayNames = {
    "SPD": "SPD",
    "Gruen": "Grüne",
    "CDU": "CDU",
    "LINKE": "Die Linke",
    "AfD": "AfD",
    "FDP": "FDP",
    "BSW": "BSW",
    "PMUT": "Tierschutz",
    "Volt": "Volt",
    "FW": "FW",
    "MLPD": "MLPD"
};

var partyColors = {
    "SPD": getComputedStyle(document.documentElement).getPropertyValue('--party-spd').trim(),
    "Gruen": getComputedStyle(document.documentElement).getPropertyValue('--party-gruen').trim(),
    "CDU": getComputedStyle(document.documentElement).getPropertyValue('--party-cdu').trim(),
    "LINKE": getComputedStyle(document.documentElement).getPropertyValue('--party-linke').trim(),
    "AfD": getComputedStyle(document.documentElement).getPropertyValue('--party-afd').trim(),
    "FDP": getComputedStyle(document.documentElement).getPropertyValue('--party-fdp').trim(),
    "BSW": getComputedStyle(document.documentElement).getPropertyValue('--party-bsw').trim(),
    "PMUT": getComputedStyle(document.documentElement).getPropertyValue('--party-tierschutz').trim(),
    "Volt": getComputedStyle(document.documentElement).getPropertyValue('--party-volt').trim(),
    "FW": getComputedStyle(document.documentElement).getPropertyValue('--party-fw').trim(),
    "MLPD": getComputedStyle(document.documentElement).getPropertyValue('--party-mlpd').trim()
};


// Function to load GeoJSON data
function loadGeoJson(year) {
    const url = year === '2021' ? 'https://kxljxv.github.io/wahlergebnisse/wahlergebnisse2021nurID.json' : 'https://kxljxv.github.io/wahlergebnisse/wahlergebnisse2025nurID.json';
    return fetch(url)
        .then(response => response.json());
}

// Function to load CSV data and parse it
function loadCsvData(year) {
    const url = year === '2021' ? 'http://kxljxv.github.io/wahlergebnisse/wahlergebnisse2021(8).csv' : 'http://kxljxv.github.io/wahlergebnisse/wahlergebnisse2025(8).csv';
    return fetch(url)
        .then(response => response.text())
        .then(csvText => {
            const lines = csvText.split('\n').slice(1); // Skip header row
            const data = {};
            lines.forEach(line => {
                const values = line.split('\t');
                if (values[0]) { // Ensure there's an ID
                    data[values[0]] = { // Use ID as key
                        "Wahlbeteiligung": parseFloat(values[1]),
                        "CDU": parseFloat(values[2]),
                        "LINKE": parseFloat(values[3]),
                        "SPD": parseFloat(values[4]),
                        "Gruen": parseFloat(values[5]),
                        "AfD": parseFloat(values[6]),
                        "FDP": parseFloat(values[7]),
                        "PMUT": parseFloat(values[8]),
                        "FW": parseFloat(values[9]),
                        "MLPD": parseFloat(values[10]),
                        "Volt": parseFloat(values[11]),
                        "BSW": parseFloat(values[12]) // BSW might only be in 2025 data
                    };
                    if (year === '2021') {
                        delete data[values[0]].BSW; // Remove BSW for 2021 if it exists
                    } else if (year === '2025') {
                        delete data[values[0]].Linke; // Use LINKE consistently
                        delete data[values[0]].Gruene; // Use Gruen consistently
                    }
                }
            });
            return data;
        });
}


// Function to initialize the map
function initializeMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://kxljxv.github.io/bm_web_gry_7.json', // Using your provided style URL
        center: [13.40, 52.52], // Berlin coordinates
        zoom: 9,
        minZoom: 8,
        maxZoom: 15,
        dragRotate: false,
        touchZoomRotate: false
    });

    map.on('load', () => {
        updateMapData(currentYear); // Load initial data for default year
    });
}

function mergeDataToGeoJson(geojsonData, electionData) {
    const features = geojsonData.features.map(feature => {
        const id = feature.properties.ID;
        const data = electionData[id] || {}; // Default to empty if no data

        // Ensure data is not undefined and then merge
        if (data) {
            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    ...data
                }
            };
        } else {
            return feature; // Feature with no additional data
        }
    });
    return { ...geojsonData, features: features };
}


function updateMapData(year) {
    Promise.all([loadGeoJson(year), loadCsvData(year)]).then(([geoJson, csvData]) => {
        const mergedGeoJson = mergeDataToGeoJson(geoJson, csvData);
        currentGeojsonData = mergedGeoJson;
        currentElectionData = csvData;
        currentYear = year;
        updateMapLayer();
    }).catch(error => console.error("Error loading data:", error));
}


function updateMapLayer() {
    if (!map.getSource('election-data')) {
        map.addSource('election-data', {
            type: 'geojson',
            data: currentGeojsonData
        });

        map.addLayer({
            id: 'election-fill',
            type: 'fill',
            source: 'election-data',
            paint: {
                'fill-color': ['get', currentDataField, ['properties']],
                'fill-opacity': 0.8,
                'fill-outline-color': '#888'
            }
        });

        map.on('click', 'election-fill', (e) => {
            if (!e.features.length) return;
            const feature = e.features[0];
            lastClickedFeatureId = feature.properties.ID;
            updateInfoBox(feature.properties);
        });
         map.on('mouseenter', 'election-fill', function() {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'election-fill', function() {
            map.getCanvas().style.cursor = '';
        });


    } else {
        map.getSource('election-data').setData(currentGeojsonData);
        map.setPaintProperty('election-fill', 'fill-color', ['get', currentDataField, ['properties']]);
    }
}

function updateInfoBox(properties) {
    document.getElementById('info-box').style.display = 'block';
    document.getElementById('district-id').innerText = 'Wahlbezirk ID: ' + properties.ID;
    updateDonutChart(properties);
}


function updateDonutChart(properties) {
    const labels = [];
    const dataValues = [];
    const backgroundColors = [];

    const parties = ["CDU", "LINKE", "SPD", "Gruen", "AfD", "FDP", "PMUT", "FW", "MLPD", "Volt", "BSW"].filter(party => properties[party] !== undefined);

    parties.forEach(party => {
        if (partyDisplayNames[party]) {
             labels.push(partyDisplayNames[party]);
             dataValues.push(properties[party]);
             backgroundColors.push(partyColors[party]);
        }
    });

    if (!resultChart) {
        const ctx = document.getElementById('resultChart').getContext('2d');
        resultChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: backgroundColors,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false, // Disable default tooltip
                        external: function(context) {
                            // Tooltip Element
                            let tooltipEl = document.getElementById('chartjs-tooltip');

                            // Create element on first render
                            if (!tooltipEl) {
                                tooltipEl = document.createElement('div');
                                tooltipEl.id = 'chartjs-tooltip';
                                tooltipEl.style.background = 'rgba(0, 0, 0, 0.7)';
                                tooltipEl.style.color = 'white';
                                tooltipEl.style.borderRadius = '3px';
                                tooltipEl.style.opacity = 1;
                                tooltipEl.style.pointerEvents = 'none';
                                tooltipEl.style.position = 'absolute';
                                tooltipEl.style.transform = 'translate(-50%, 0)';
                                tooltipEl.style.transition = 'all .1s ease';

                                const table = document.createElement('table');
                                tooltipEl.appendChild(table);
                                context.chart.canvas.parentNode.appendChild(tooltipEl);
                            }

                            // Hide if no tooltip
                            const tooltip = context.tooltip;
                            if (tooltip.opacity === 0) {
                                tooltipEl.style.opacity = 0;
                                return;
                            }

                            // Set caret Position and styles
                            tooltipEl.classList.remove('above', 'below', 'no-transform');
                            if (tooltip.yAlign) {
                                tooltipEl.classList.add(tooltip.yAlign);
                            } else {
                                tooltipEl.classList.add('no-transform');
                            }

                            function getBody(bodyItem) {
                                return bodyItem.lines;
                            }

                            // Set Text
                            if (tooltip.body) {
                                const titleLines = tooltip.title || [];
                                const bodyLines = tooltip.body.map(getBody);

                                let innerHtml = '<thead>';

                                titleLines.forEach(function(title) {
                                    innerHtml += '<tr><th>' + title + '</th></tr>';
                                });
                                innerHtml += '</thead><tbody>';

                                bodyLines.forEach(function(body, i) {
                                    const colors = tooltip.labelColors[i];
                                    let style = 'background:' + colors.backgroundColor;
                                    style += '; border-color:' + colors.borderColor;
                                    style += '; border-width: 2px';
                                    const span = '<span style="' + style + '"></span>';
                                    innerHtml += '<tr><td>' + span + body + '</td></tr>';
                                });
                                innerHtml += '</tbody>';

                                let tableRoot = tooltipEl.querySelector('table');
                                tableRoot.innerHTML = innerHtml;
                            }

                            const position = context.chart.canvas.getBoundingClientRect();

                            // Display, position, and set styles for element
                            tooltipEl.style.opacity = 1;
                            tooltipEl.style.left = position.left + tooltip.caretX + 'px';
                            tooltipEl.style.top = position.top + tooltip.caretY+ 'px';
                            tooltipEl.style.font = tooltip.options.bodyFont.string;
                            tooltipEl.style.padding = tooltip.padding + 'px ' + tooltip.padding + 'px';
                        }
                    }
                }
            }
        });
    } else {
        resultChart.data.labels = labels;
        resultChart.data.datasets[0].data = dataValues;
        resultChart.data.datasets[0].backgroundColor = backgroundColors;
        resultChart.update();
    }
}

// Event listeners for selectors
document.getElementById('data-selector').addEventListener('change', function(e) {
    currentDataField = e.target.value;
    updateMapLayer();
});

document.getElementById('year-selector').addEventListener('change', function(e) {
    currentYear = e.target.value;
    updateMapData(currentYear);
});

// Initialize map on page load
document.addEventListener('DOMContentLoaded', initializeMap);

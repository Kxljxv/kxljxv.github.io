/***********************
 * Zentrale Farbvariablen – bitte hier die Platzhalterfarben anpassen
 ***********************/
/*— already defined in CSS —*/

/***********************
 * Datensätze und Konfiguration
 ***********************/
var dataset2025 = {
    url: 'https://kxljxv.github.io/wahlergebnisse2025.json',
    partyRanges: {
        "SPDinkBW": { min: 0.06, max: 0.39984263 },
        "GrueninkBW": { min: 0.015, max: 0.541414141 },
        "CDUinkBW": { min: 0.025714286, max: 0.46 },
        "LINKEinkBW": { min: 0.011583012, max: 0.5 },
        "AfDinkBW": { min: 0.005931198, max: 0.5 },
        "FDPinkBW": { min: 0.004, max: 0.268841395 },
        "BSWinkBWB": { min: 0.012, max: 0.16 },
        "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": { min: 0.0, max: 0.085704944 },
        "VoltDeutschlandinkBW": { min: 0.0, max: 0.029 },
        "FWinkBW": { min: 0.0, max: 0.034937014 },
        "MLPDinkBW": { min: 0.0, max: 0.012658228 }
    },
    availableParties: [
        "SPDinkBW", "GrueninkBW", "CDUinkBW", "LINKEinkBW",
        "AfDinkBW", "FDPinkBW", "BSWinkBWB", "PARTEIMENSCHUMWELTTIERSCHUTZinkBW",
        "VoltDeutschlandinkBW", "FWinkBW", "MLPDinkBW"
    ]
};

var dataset2021 = {
    url: 'https://kxljxv.github.io/wahlergebnisse2021.json',
    partyRanges: {
        "SPDinkBW": { min: 0.06, max: 0.39984263 },
        "GrueninkBW": { min: 0.015, max: 0.541414141 },
        "CDUinkBW": { min: 0.025714286, max: 0.46 },
        "LinkeinkBW": { min: 0.011583012, max: 0.5 },
        "AfDinkBW": { min: 0.005931198, max: 0.5 },
        "FDPinkBW": { min: 0.004, max: 0.268841395 },
        "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": { min: 0.0, max: 0.085704944 },
        "VoltinkBW": { min: 0.0, max: 0.029 },
        "FWinkBW": { min: 0.0, max: 0.034937014 },
        "MLPDinkBW": { min: 0.0, max: 0.012658228 }
    },
    availableParties: [
        "SPDinkBW", "GrueninkBW", "CDUinkBW", "LinkeinkBW",
        "AfDinkBW", "FDPinkBW", "PARTEIMENSCHUMWELTTIERSCHUTZinkBW",
        "VoltinkBW", "FWinkBW", "MLPDinkBW"
    ]
};

// Um Mapping-Probleme zu lösen: Wenn "VoltinkBW" (2021) und "Volt" (2025) dieselbe Partei darstellen, definieren wir ein Mapping
var partyMapping = {
    "VoltinkBW": "Volt"
};

var currentDataset = dataset2025;
var currentParty = "Gewinner";  // Standardmäßig Gewinner-Modus
var geojsonData = null;
var lastClickedFeature = null; // Variable, um das zuletzt geklickte Feature zu speichern
var infoPanelVisible = false; // Zustand, ob das Info-Panel sichtbar ist

/***********************
 * Karte initialisieren
 ***********************/
var map = new maplibregl.Map({
    container: 'map',
    style: 'https://kxljxv.github.io/bm_web_gry_7.json',
    center: [13.40, 52.52],
    zoom: 8,
    minZoom: 6,
    maxBounds: [[12.5, 51.5], [14.5, 53]],
    attributionControl: false,
    interactive: true // wichtig, um Interaktionen zu ermöglichen
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();


/***********************
 * GeoJSON-Daten laden
 ***********************/
function loadGeoJson() {
    fetch(currentDataset.url)
        .then(response => response.json())
        .then(data => {
            geojsonData = data;
            updateMapColors();
            if (!map.getSource('geojson-layer')) {
                map.addSource('geojson-layer', { type: 'geojson', data: geojsonData });
                var firstLayerId = map.getStyle().layers[0].id;
                map.addLayer({
                    id: 'geojson-fill',
                    type: 'fill',
                    source: 'geojson-layer',
                    paint: {
                        'fill-color': ['get', 'fillColor'],
                        'fill-opacity': 1,
                        'fill-outline-color': 'transparent'
                    }
                }, firstLayerId);
            } else {
                map.getSource('geojson-layer').setData(geojsonData);
            }
        })
        .catch(error => console.error('Fehler beim Laden der GeoJSON-Daten:', error));
}
loadGeoJson();

/***********************
 * Farben aktualisieren
 ***********************/
function updateMapColors() {
    if (!geojsonData) return;
    geojsonData.features.forEach(function(feature) {
        var fillColor;
        if (currentParty === "Gewinner") {
            // Gewinner-Modus: Ermittle die höchste Partei, verwende einheitliche Farbe (Platzhalter aus CSS)
            var winningParty = null, winningValue = 0;
            currentDataset.availableParties.forEach(function(key) {
                var val = parseFloat(feature.properties[key].replace(',', '.'));
                if (val > winningValue) {
                    winningValue = val;
                    winningParty = key;
                }
            });
            fillColor = getPartyColor(winningParty);
        } else {
            var val = parseFloat(feature.properties[currentParty].replace(',', '.'));
            var range = currentDataset.partyRanges[currentParty];
            var norm = (val - range.min) / (range.max - range.min);
            norm = Math.max(0, Math.min(norm, 1));
            fillColor = interpolateColor("#f0f0f0", getPartyColor(currentParty), norm);
        }
        feature.properties.fillColor = fillColor;
    });
    if (map.getSource('geojson-layer')) {
        map.getSource('geojson-layer').setData(geojsonData);
    }
    if (lastClickedFeature) updateChart(lastClickedFeature); // Chart aktualisieren mit dem gespeicherten Feature
}

function interpolateColor(color1, color2, factor) {
    var c1 = hexToRgb(color1);
    var c2 = hexToRgb(color2);
    var result = {
        r: Math.round(c1.r + (c2.r - c1.r) * factor),
        g: Math.round(c1.g + (c2.g - c1.g) * factor),
        b: Math.round(c1.b + (c2.b - c1.b) * factor)
    };
    return "rgb(" + result.r + ", " + result.g + ", " + result.b + ")";
}
function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    var bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

// Gibt die Farbe zurück – hier getrennt für regulär, Gewinner, Button und Chart
function getPartyColor(key) {
    // Für reguläre Kartenfarben:
    switch (key) {
        case "SPDinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-spd-reg').trim();
        case "GrueninkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-gruen-reg').trim();
        case "CDUinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-cdu-reg').trim();
        case "LINKEinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-linke-reg').trim();
        case "LinkeinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-linke-reg').trim();
        case "AfDinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-afd-reg').trim();
        case "FDPinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-fdp-reg').trim();
        case "BSWinkBWB": return getComputedStyle(document.documentElement).getPropertyValue('--party-bsw-reg').trim();
        case "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-tierschutz-reg').trim();
        case "VoltDeutschlandinkBW":
        case "VoltinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-volt-reg').trim();
        case "FWinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-fw-reg').trim();
        case "MLPDinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--party-mlpd-reg').trim();
        default: return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    }
}


/***********************
 * amCharts Donut Chart
 ***********************/
var chart;

function createChart() {
    am5.ready(function() {

        // Create root element
        // https://www.amcharts.com/docs/v5/getting-started/#Root_element
        var root = am5.Root.new("chartdiv");

        // Set themes
        // https://www.amcharts.com/docs/v5/themes/
        root.setThemes([
            am5themes_Dark.new(root),
            am5themes_Animated.new(root)
        ]);

        // Create chart
        // https://www.amcharts.com/docs/v5/charts/percent-charts/pie-chart/
        chart = root.container.children.push(am5percent.PieChart.new(root, {
            layout: root.verticalLayout()
        }));

        // Create series
        // https://www.amcharts.com/docs/v5/charts/percent-charts/pie-chart/#Series
        var series = chart.series.push(am5percent.PieSeries.new(root, {
            valueField: "percentage",
            categoryField: "party",
            alignLabels: false
        }));

        series.labels.template.setAll({
            textType: "circular",
            centerX: 0,
            centerY: 0
        });

        // Add legend - In this version, legend is not needed as per request
        // https://www.amcharts.com/docs/v5/charts/percent-charts/pie-chart/#Legend
        // var legend = am5.Legend.new(root, {});
        // series.appear(1000, 100);


        series.on("tooltipDataItem", function(tooltipDataItem) {
            if (tooltipDataItem) {
                tooltipDataItem.tooltipText = "{category}: {valuePercentTotal.formatNumber('#.00')}%";
            }
        });


        series.data.setAll([]); // Initial empty data

        // Make series адаптивным für responsive Layouts
        series.slices.template.set("adapterfillStyleModifier", function(fillStyle, target) {
            fillStyle.cornerRadius = 5;
            return fillStyle;
        });


        // series.slices.template.set("fillGradient", am5.LinearGradient.new(root, {
        //     stops: [{
        //         color:am5.color(0x000000)
        //     }, {
        //         color:am5.color(0x000000)
        //     }]
        // }));

        return chart;
    }); // end am5.ready()
}

createChart();


function updateChart(feature) {
    lastClickedFeature = feature;
    var chartData = [];
    currentDataset.availableParties.forEach(function(key) {
        var val = parseFloat(feature.properties[key].replace(',', '.'));
        chartData.push({
            party: partyDisplayNames[key] || key,
            percentage: (val * 100).toFixed(2),
            color: getPartyColor(key) // Farbe für jedes Segment
        });
    });

    // Set colors for segments dynamically
    chart.series.getIndex(0).slices.template.set("fill", function(fill, target) {
        var dataContext = target.dataItem.dataContext;
        return am5.color(hexToRgb(dataContext.color)); // Convert hex to RGB for amCharts
    });


    chart.series.getIndex(0).data.setAll(chartData);


    // Aktualisiere auch den Header des Info-Panels, um den Wahlbezirk anzuzeigen (z.B. UWB)
    var district = feature.properties.UWB || "";
    document.getElementById('districtName').innerText = district;


    // Show info panel with animation
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.classList.add('visible');
    infoPanelVisible = true; // Panel ist nun sichtbar
}


/***********************
 * Interaktive Karte: Marker und Klick-Event
 ***********************/
var marker;
map.on('click', 'geojson-fill', function(e) {
    if (!e.features.length) return;
    var feature = e.features[0];
    updateChart(feature); // Funktion zum Aktualisieren des Charts aufrufen

    if (marker) marker.remove();
    marker = new maplibregl.Marker({ color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() })
        .setLngLat(e.lngLat)
        .addTo(map);

    // Show info panel if it was hidden
    if (!infoPanelVisible) {
        const infoPanel = document.getElementById('infoPanel');
        infoPanel.classList.add('visible');
        infoPanelVisible = true;
    }
});


map.on('mouseenter', 'geojson-fill', function() {
    map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'geojson-fill', function() {
    map.getCanvas().style.cursor = '';
});


/***********************
 * Parteiauswahl: Select Box
 ***********************/
var partySelect = document.getElementById('partySelect');
var partyDisplayNames = {
    "SPDinkBW": "SPD",
    "GrueninkBW": "Grüne",
    "CDUinkBW": "CDU",
    "LINKEinkBW": "Die Linke",
    "LinkeinkBW": "Die Linke",
    "AfDinkBW": "AfD",
    "FDPinkBW": "FDP",
    "BSWinkBWB": "BSW",
    "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": "Tierschutz",
    "VoltDeutschlandinkBW": "Volt",
    "VoltinkBW": "Volt",
    "FWinkBW": "FW",
    "MLPDinkBW": "MLPD"
};


partySelect.addEventListener('change', function(e) {
    currentParty = e.target.value;
    updateMapColors();
});


// Initialisierung auf 2025 und Gewinner (default)
var currentDataset = dataset2025;
var currentParty = "Gewinner";
document.getElementById('partySelect').value = currentParty; // Set select box to default value

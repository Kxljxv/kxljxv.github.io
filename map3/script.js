/****************************************************
 * 1) Datasets & Configuration
 ****************************************************/
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

// We can map "VoltinkBW" from 2021 to "Volt" in 2025 if needed:
var partyMapping = {
  "VoltinkBW": "Volt"
};

// This object is used to display nicer party names in the donut chart
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

// Current dataset & party
var currentDataset = dataset2025;
var currentParty = "winner"; // default mode could be 'winner'
var geojsonData = null;

/****************************************************
 * 2) Map Initialization (MapLibre)
 ****************************************************/
var map = new maplibregl.Map({
  container: 'map',
  style: 'https://kxljxv.github.io/bm_web_gry_7.json',
  center: [13.40, 52.52],
  zoom: 8,
  minZoom: 6,
  maxBounds: [[12.5, 51.5], [14.5, 53]],
  attributionControl: false
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

/****************************************************
 * 3) Load GeoJSON & Add to Map
 ****************************************************/
function loadGeoJson() {
  fetch(currentDataset.url)
    .then(response => response.json())
    .then(data => {
      geojsonData = data;
      updateMapColors();
      // If layer doesn't exist yet, add it
      if (!map.getSource('geojson-layer')) {
        map.addSource('geojson-layer', { type: 'geojson', data: geojsonData });
        // Insert below the first existing layer
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

/****************************************************
 * 4) Coloring the Map Based on "currentParty"
 ****************************************************/
function updateMapColors() {
  if (!geojsonData) return;

  geojsonData.features.forEach(function(feature) {
    let fillColor;

    if (currentParty === "winner") {
      // Determine the party with the highest value
      let winningParty = null, winningValue = 0;
      currentDataset.availableParties.forEach(key => {
        let val = parseFloat((feature.properties[key] || "0").replace(',', '.'));
        if (val > winningValue) {
          winningValue = val;
          winningParty = key;
        }
      });
      fillColor = getPartyColor(winningParty);

    } else if (currentParty === "turnout") {
      // Example "turnout" logic if your data has "turnout" property:
      // We'll just map turnout 0% => #f0f0f0, 100% => getPartyColor('someKey')
      // If you do not have turnout in your data, adapt or remove this logic.
      let turnoutVal = parseFloat(feature.properties["turnout"] || 0);
      fillColor = interpolateColor("#f0f0f0", "#a3512b", turnoutVal / 100);

    } else {
      // A specific party
      let val = parseFloat((feature.properties[currentParty] || "0").replace(',', '.'));
      let range = currentDataset.partyRanges[currentParty];
      // Normalized range
      let norm = 0;
      if (range) {
        norm = (val - range.min) / (range.max - range.min);
        norm = Math.max(0, Math.min(norm, 1));
      }
      fillColor = interpolateColor("#f0f0f0", getPartyColor(currentParty), norm);
    }

    feature.properties.fillColor = fillColor;
  });

  if (map.getSource('geojson-layer')) {
    map.getSource('geojson-layer').setData(geojsonData);
  }

  // Update donut chart if we have a selected feature
  if (lastClickedFeature) updateDonutChart(lastClickedFeature);
}

// Helper: linear interpolation between two colors
function interpolateColor(color1, color2, factor) {
  let c1 = hexToRgb(color1);
  let c2 = hexToRgb(color2);
  let result = {
    r: Math.round(c1.r + (c2.r - c1.r) * factor),
    g: Math.round(c1.g + (c2.g - c1.g) * factor),
    b: Math.round(c1.b + (c2.b - c1.b) * factor)
  };
  return "rgb(" + result.r + ", " + result.g + ", " + result.b + ")";
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  let bigint = parseInt(hex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

// Returns the color for a party key
function getPartyColor(key) {
  // Adapt to your desired colors or keep them from the old code
  switch(key) {
    case "SPDinkBW": return "#D63C3C";
    case "GrueninkBW": return "#028902";
    case "CDUinkBW": return "#767576";
    case "LINKEinkBW":
    case "LinkeinkBW": return "#C72DC1";
    case "AfDinkBW": return "#4667FA";
    case "FDPinkBW": return "#6b4c00";
    case "BSWinkBWB": return "#6a0dad";
    case "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": return "#005c5c";
    case "VoltDeutschlandinkBW":
    case "VoltinkBW":
    case "Volt": return "#4b2e83";
    case "FWinkBW": return "#8a5a00";
    case "MLPDinkBW": return "#7a112f";
    default: return "#a3512b"; // accent fallback
  }
}

/****************************************************
 * 5) Donut Chart with amCharts
 ****************************************************/
// We'll create an amCharts 5 chart instance once, then update data.
var root = am5.Root.new("chartdiv");
root.setThemes([ am5themes_Dark.new(root) ]);
var chart = root.container.children.push(
  am5percent.PieChart.new(root, {
    innerRadius: am5.percent(50) // Donut
  })
);
var series = chart.series.push(
  am5percent.PieSeries.new(root, {
    valueField: "value",
    categoryField: "party",
    // No legend here. We use only hover tooltips:
    tooltip: am5.Tooltip.new(root, {})
  })
);
// On hover, show e.g. "Grüne: 25%"
series.slices.template.setAll({
  tooltipText: "{party}: {value} %"
});

/** Called every time we click on a district or change the year/party. */
function updateDonutChart(feature) {
  lastClickedFeature = feature;

  let dataArray = [];
  currentDataset.availableParties.forEach(function(key) {
    let val = parseFloat((feature.properties[key] || "0").replace(',', '.')) * 100;
    dataArray.push({
      party: partyDisplayNames[key] || key,
      value: val.toFixed(2)
    });
  });

  // Update the chart data
  series.data.setAll(dataArray);

  // Update the title above the chart
  let district = feature.properties.UWB || "Unbekannt";
  document.getElementById("districtTitle").innerText = "Wahlbezirk: " + district;
}

/****************************************************
 * 6) Map Interactivity: click event
 ****************************************************/
var lastClickedFeature = null;
var marker;
map.on('click', 'geojson-fill', function(e) {
  if (!e.features.length) return;
  let feature = e.features[0];

  // Show side panel (if hidden)
  let panel = document.getElementById("infoPanel");
  panel.classList.remove("hidden");
  panel.classList.add("open");

  // Update chart
  updateDonutChart(feature);

  // Place a marker
  if (marker) marker.remove();
  marker = new maplibregl.Marker({ color: "#a3512b" })
    .setLngLat(e.lngLat)
    .addTo(map);
});
map.on('mouseenter', 'geojson-fill', function() {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'geojson-fill', function() {
  map.getCanvas().style.cursor = '';
});

/****************************************************
 * 7) Search Field
 ****************************************************/
document.getElementById('searchField').addEventListener('input', function(e) {
  var query = e.target.value.toLowerCase();
  // Basic sample: if user types 'alexanderplatz', fly to it
  if (query.includes("alexanderplatz")) {
    map.flyTo({ center: [13.411, 52.521], zoom: 13 });
  } else if (query.includes("potsdamer platz")) {
    map.flyTo({ center: [13.376, 52.509], zoom: 13 });
  } else {
    // Filter features by UWB or address
    if (!geojsonData) return;
    let filtered = JSON.parse(JSON.stringify(geojsonData));
    filtered.features = filtered.features.filter(function(feature) {
      let districtName = (feature.properties.UWB || "").toLowerCase();
      let address = (feature.properties.adresse || "").toLowerCase();
      return districtName.includes(query) || address.includes(query);
    });
    if (map.getSource('geojson-layer')) {
      map.getSource('geojson-layer').setData(filtered);
    }
  }
});

/****************************************************
 * 8) Two Select Boxes: Year & Party/Winner/Turnout
 ****************************************************/
document.getElementById("yearSelect").addEventListener("change", function(e) {
  let chosenYear = e.target.value;
  currentDataset = (chosenYear === "2025") ? dataset2025 : dataset2021;

  // If currentParty doesn't exist in new dataset, try mapping or fallback:
  if (currentParty !== "winner" && currentParty !== "turnout") {
    if (!currentDataset.availableParties.includes(currentParty)) {
      currentParty = partyMapping[currentParty] || "winner";
    }
  }
  populatePartySelect(); // Rebuild the party dropdown
  loadGeoJson(); // Reload data & recolor
});

document.getElementById("partySelect").addEventListener("change", function(e) {
  let chosenParty = e.target.value;
  currentParty = chosenParty; // e.g. "winner", "turnout", or "SPDinkBW", ...
  updateMapColors();
  // If we already have a selected feature, update chart:
  if (lastClickedFeature) {
    updateDonutChart(lastClickedFeature);
  }
});

/** Populate the #partySelect with all relevant options. */
function populatePartySelect() {
  let partySelect = document.getElementById("partySelect");
  partySelect.innerHTML = "";

  // Add special options "winner" and "turnout"
  let optWinner = document.createElement("option");
  optWinner.value = "winner";
  optWinner.text = "Gewinner (Modus)";
  partySelect.appendChild(optWinner);

  let optTurnout = document.createElement("option");
  optTurnout.value = "turnout";
  optTurnout.text = "Wahlbeteiligung (Turnout)";
  partySelect.appendChild(optTurnout);

  // Then add the parties from the current dataset
  currentDataset.availableParties.forEach(function(key) {
    let niceName = partyDisplayNames[key] || key;
    let opt = document.createElement("option");
    opt.value = key;
    opt.text = niceName;
    partySelect.appendChild(opt);
  });

  // Select the currently active one
  partySelect.value = currentParty;
}

// Initialize
populatePartySelect();

/***********************
 * Datensätze und Konfiguration
 ***********************/
const dataset2025 = {
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

const dataset2021 = {
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

// Party name mapping for display
const partyDisplayNames = {
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

// Party color mapping
const partyColors = {
  "SPDinkBW": "#D63C3C",
  "GrueninkBW": "#028902",
  "CDUinkBW": "#767576",
  "LINKEinkBW": "#C72DC1",
  "LinkeinkBW": "#C72DC1",
  "AfDinkBW": "#4667FA",
  "FDPinkBW": "#6b4c00",
  "BSWinkBWB": "#6a0dad",
  "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": "#005c5c",
  "VoltDeutschlandinkBW": "#4b2e83",
  "VoltinkBW": "#4b2e83",
  "FWinkBW": "#8a5a00",
  "MLPDinkBW": "#7a112f"
};

// For mapping between different dataset keys
const partyMapping = {
  "VoltinkBW": "VoltDeutschlandinkBW",
  "LinkeinkBW": "LINKEinkBW"
};

let currentDataset = dataset2025;
let currentParty = "Gewinner";
let geojsonData = null;
let chart = null;
let selectedFeature = null;
let marker = null;

/***********************
 * Map Initialization
 ***********************/
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://kxljxv.github.io/bm_web_gry_7.json',
  center: [13.40, 52.52],
  zoom: 10,
  minZoom: 8,
  maxBounds: [[12.5, 51.5], [14.5, 53]],
  attributionControl: false
});

map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

/***********************
 * Event Listeners
 ***********************/
document.querySelectorAll('.year-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    
    const selectedYear = this.getAttribute('data-year');
    document.getElementById('yearSelect').value = selectedYear;
    currentDataset = (selectedYear === "2025") ? dataset2025 : dataset2021;
    
    populatePartySelect();
    loadGeoJson();
  });
});

document.getElementById('yearSelect').addEventListener('change', function() {
  const selectedYear = this.value;
  
  // Update top buttons to match
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-year') === selectedYear);
  });
  
  currentDataset = (selectedYear === "2025") ? dataset2025 : dataset2021;
  populatePartySelect();
  loadGeoJson();
  
  if (selectedFeature) {
    updateDonutChart(selectedFeature);
  }
});

document.getElementById('partySelect').addEventListener('change', function() {
  currentParty = this.value;
  updateMapColors();
});

document.getElementById('searchField').addEventListener('input', function(e) {
  const query = e.target.value.toLowerCase();
  
  if (query.includes("alexanderplatz")) {
    map.flyTo({ center: [13.411, 52.521], zoom: 13 });
  } else if (query.includes("potsdamer platz")) {
    map.flyTo({ center: [13.376, 52.509], zoom: 13 });
  } else {
    if (!geojsonData) return;
    
    const filtered = JSON.parse(JSON.stringify(geojsonData));
    filtered.features = filtered.features.filter(function(feature) {
      return feature.properties.UWB.toLowerCase().includes(query) ||
             (feature.properties.adresse && feature.properties.adresse.toLowerCase().includes(query));
    });
    
    if (map.getSource('geojson-layer')) {
      map.getSource('geojson-layer').setData(filtered);
    }
  }
});

/***********************
 * Functions
 ***********************/
function loadGeoJson() {
  fetch(currentDataset.url)
    .then(response => response.json())
    .then(data => {
      geojsonData = data;
      updateMapColors();
      
      if (!map.getSource('geojson-layer')) {
        map.on('load', function() {
          map.addSource('geojson-layer', { 
            type: 'geojson', 
            data: geojsonData 
          });
          
          map.addLayer({
            id: 'geojson-fill',
            type: 'fill',
            source: 'geojson-layer',
            paint: {
              'fill-color': ['get', 'fillColor'],
              'fill-opacity': 0.8,
              'fill-outline-color': '#ffffff'
            }
          });
          
          // Add hover effect
          map.addLayer({
            id: 'geojson-hover',
            type: 'line',
            source: 'geojson-layer',
            paint: {
              'line-color': '#ffffff',
              'line-width': 2,
              'line-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                1,
                0
              ]
            }
          });
          
          // Add click event
          map.on('click', 'geojson-fill', handleMapClick);
          
          // Add hover states
          let hoveredStateId = null;
          
          map.on('mousemove', 'geojson-fill', (e) => {
            if (e.features.length > 0) {
              if (hoveredStateId !== null) {
                map.setFeatureState(
                  { source: 'geojson-layer', id: hoveredStateId },
                  { hover: false }
                );
              }
              
              hoveredStateId = e.features[0].id;
              
              map.setFeatureState(
                { source: 'geojson-layer', id: hoveredStateId },
                { hover: true }
              );
              
              map.getCanvas().style.cursor = 'pointer';
            }
          });
          
          map.on('mouseleave', 'geojson-fill', () => {
            if (hoveredStateId !== null) {
              map.setFeatureState(
                { source: 'geojson-layer', id: hoveredStateId },
                { hover: false }
              );
            }
            hoveredStateId = null;
            map.getCanvas().style.cursor = '';
          });
        });
      } else {
        map.getSource('geojson-layer').setData(geojsonData);
      }
    })
    .catch(error => console.error('Fehler beim Laden der GeoJSON-Daten:', error));
}

function handleMapClick(e) {
  if (!e.features.length) return;
  
  selectedFeature = e.features[0];
  
  // Update marker
  if (marker) marker.remove();
  marker = new maplibregl.Marker({ color: '#ffffff' })
    .setLngLat(e.lngLat)
    .addTo(map);
  
  // Show district info panel
  document.getElementById('district').textContent = `Wahlbezirk: ${selectedFeature.properties.UWB}`;
  document.getElementById('dataPanel').classList.add('panel-visible');
  
  // Update chart
  updateDonutChart(selectedFeature);
}

function updateMapColors() {
  if (!geojsonData) return;
  
  geojsonData.features.forEach(function(feature, index) {
    // Add an id for feature state
    feature.id = index;
    
    if (currentParty === "Gewinner") {
      // Gewinner-Modus: Find the party with the highest percentage
      let winningParty = null;
      let winningValue = 0;
      
      currentDataset.availableParties.forEach(function(key) {
        const val = parseFloat(feature.properties[key].replace(',', '.'));
        if (val > winningValue) {
          winningValue = val;
          winningParty = key;
        }
      });
      
      feature.properties.fillColor = partyColors[winningParty];
    } else if (currentParty === "Wahlbeteiligung") {
      // Special case for voter turnout if available
      const turnout = feature.properties.Wahlbeteiligung ? 
        parseFloat(feature.properties.Wahlbeteiligung.replace(',', '.')) : 0.5;
      
      // Create a gradient from red (low) to green (high)
      const intensity = Math.min(1, Math.max(0, turnout));
      feature.properties.fillColor = interpolateColor("#ff4444", "#44ff44", intensity);
    } else {
      // Regular party view: show gradient based on percentage
      const val = parseFloat(feature.properties[currentParty].replace(',', '.'));
      const range = currentDataset.partyRanges[currentParty];
      const norm = (val - range.min) / (range.max - range.min);
      const normalized = Math.max(0, Math.min(norm, 1));
      
      feature.properties.fillColor = interpolateColor("#f0f0f0", partyColors[currentParty], normalized);
    }
  });
  
  if (map.getSource('geojson-layer')) {
    map.getSource('geojson-layer').setData(geojsonData);
  }
}

function updateDonutChart(feature) {
  const chartDiv = document.getElementById('chartDiv');
  
  // Clear previous chart
  if (chart) {
    chart.dispose();
  }
  
  // Create root element
  const root = am5.Root.new(chartDiv);
  
  // Set themes
  root.setThemes([am5themes_Animated.new(root)]);
  
  // Create chart
  const chart = root.container.children.push(
    am5percent.PieChart.new(root, {
      layout: root.horizontalLayout,
      innerRadius: am5.percent(50)
    })
  );
  
  // Create series
  const series = chart.series.push(
    am5percent.PieSeries.new(root, {
      valueField: "value",
      categoryField: "category",
      alignLabels: false
    })
  );
  
  // Configure labels
  series.labels.template.setAll({
    textType: "circular",
    radius: 4,
    inside: true,
    fill: am5.color(0xffffff),
    visible: false // Hide labels by default
  });
  
  // Set up tooltip
  series.slices.template.set("tooltipText", "[bold]{category}:[/] {valuePercentTotal.formatNumber('0.0')}%");
  series.slices.template.set("stroke", am5.color(0xffffff));
  series.slices.template.set("strokeWidth", 1);
  
  // Prepare data
  const data = [];
  currentDataset.availableParties.forEach(function(key) {
    const val = parseFloat(feature.properties[key].replace(',', '.'));
    if (val > 0.01) { // Only include parties with more than 1%
      data.push({
        category: partyDisplayNames[key],
        value: val * 100, // Convert to percentage
        color: partyColors[key]
      });
    }
  });
  
  // Sort data by value (descending)
  data.sort((a, b) => b.value - a.value);
  
  // Set colors from party colors
  series.slices.template.adapters.add("fill", function(fill, target) {
    return am5.color(target.dataItem.dataContext.color);
  });
  
  // Add data to series
  series.data.setAll(data);
  
  // Add legend
  chart.children.push(am5.Legend.new(root, {
    centerX: am5.percent(50),
    x: am5.percent(50),
    layout: root.horizontalLayout,
    visible: false
  }));
}

function populatePartySelect() {
  const select = document.getElementById('partySelect');
  const currentValue = select.value;
  
  // Clear options except first two standard options
  while (select.options.length > 2) {
    select.remove(2);
  }
  
  // Add party options
  currentDataset.availableParties.forEach(party => {
    const option = document.createElement('option');
    option.value = party;
    option.textContent = partyDisplayNames[party];
    select.appendChild(option);
  });
  
  // Restore selection if possible, otherwise default to "Gewinner"
  if (currentDataset.availableParties.includes(currentValue)) {
    select.value = currentValue;
  } else if (partyMapping[currentValue] && currentDataset.availableParties.includes(partyMapping[currentValue])) {
    select.value = partyMapping[currentValue];
  } else {
    select.value = "Gewinner";
  }
  
  // Update current party selection
  currentParty = select.value;
}

function interpolateColor(color1, color2, factor) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  
  const result = {
    r: Math.round(c1.r + (c2.r - c1.r) * factor),
    g: Math.round(c1.g + (c2.g - c1.g) * factor),
    b: Math.round(c1.b + (c2.b - c1.b) * factor)
  };
  
  return `rgb(${result.r}, ${result.g}, ${result.b})`;
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  const bigint = parseInt(hex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

// Initialize
loadGeoJson();
populatePartySelect();

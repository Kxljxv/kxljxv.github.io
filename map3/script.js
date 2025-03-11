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
    "MLPDinkBW": { min: 0.0, max: 0.012658228 },
    "Wahlbeteiligung": { min: 0.5, max: 0.85 }
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
    "MLPDinkBW": { min: 0.0, max: 0.012658228 },
    "Wahlbeteiligung": { min: 0.5, max: 0.85 }
  },
  availableParties: [
    "SPDinkBW", "GrueninkBW", "CDUinkBW", "LinkeinkBW",
    "AfDinkBW", "FDPinkBW", "PARTEIMENSCHUMWELTTIERSCHUTZinkBW",
    "VoltinkBW", "FWinkBW", "MLPDinkBW"
  ]
};

// Mapping zwischen den Parteien in verschiedenen Jahren
var partyMapping = {
  "VoltinkBW": "VoltDeutschlandinkBW",
  "LinkeinkBW": "LINKEinkBW" 
};

// Parteinamen für die Anzeige
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
  "MLPDinkBW": "MLPD",
  "Wahlbeteiligung": "Wahlbeteiligung"
};

// Parteifarben
var partyColors = {
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
  "MLPDinkBW": "#7a112f",
  "Wahlbeteiligung": "#a3512b"
};

var currentDataset = dataset2025;
var currentParty = "Gewinner";
var geojsonData = null;
var chart = null;
var lastClickedFeature = null;
var marker = null;

/***********************
 * Karte initialisieren
 ***********************/
var map = new maplibregl.Map({
  container: 'map',
  style: 'https://kxljxv.github.io/bm_web_gry_7.json',
  center: [13.40, 52.52],
  zoom: 9,
  minZoom: 8,
  maxBounds: [[12.5, 51.5], [14.5, 53]],
  attributionControl: false
});

map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

// Warten bis die Karte geladen ist
map.on('load', function() {
  loadGeoJson();
  setupEventListeners();
});

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
        map.addSource('geojson-layer', { 
          type: 'geojson', 
          data: geojsonData 
        });
        
        // Layer für die Wahlbezirke hinzufügen
        map.addLayer({
          id: 'district-fill',
          type: 'fill',
          source: 'geojson-layer',
          paint: {
            'fill-color': ['get', 'fillColor'],
            'fill-opacity': 0.8
          }
        });
        
        // Outline für die Wahlbezirke
        map.addLayer({
          id: 'district-line',
          type: 'line',
          source: 'geojson-layer',
          paint: {
            'line-color': '#ffffff',
            'line-width': 1,
            'line-opacity': 0.5
          }
        });
      } else {
        map.getSource('geojson-layer').setData(geojsonData);
      }
    })
    .catch(error => console.error('Fehler beim Laden der GeoJSON-Daten:', error));
}

/***********************
 * Event Listeners einrichten
 ***********************/
function setupEventListeners() {
  // Jahr wählen
  document.getElementById('yearSelect').addEventListener('change', function() {
    currentDataset = this.value === "2025" ? dataset2025 : dataset2021;
    loadGeoJson();
    updatePartySelect();
  });
  
  // Partei auswählen
  document.getElementById('partySelect').addEventListener('change', function() {
    currentParty = this.value;
    updateMapColors();
    if (lastClickedFeature) {
      updateDistrictPanel(lastClickedFeature);
    }
  });
  
  // Suchfeld
  document.getElementById('searchField').addEventListener('input', function(e) {
    var query = e.target.value.toLowerCase();
    if (query.length < 2) return;
    
    // Bekannte Orte direkt ansteuern
    if (query.includes("alexanderplatz")) {
      map.flyTo({ center: [13.411, 52.521], zoom: 13 });
      return;
    } else if (query.includes("potsdamer platz")) {
      map.flyTo({ center: [13.376, 52.509], zoom: 13 });
      return;
    }
    
    // Ansonsten in den Daten suchen
    if (!geojsonData) return;
    
    var filtered = JSON.parse(JSON.stringify(geojsonData));
    filtered.features = filtered.features.filter(function(feature) {
      return feature.properties.UWB && 
             feature.properties.UWB.toLowerCase().includes(query);
    });
    
    if (filtered.features.length === 1) {
      // Einzelnes Ergebnis gefunden - direkt ansteuern
      var center = getCenterFromGeometry(filtered.features[0].geometry);
      map.flyTo({ center: center, zoom: 12 });
      updateDistrictPanel(filtered.features[0]);
      
      // Marker setzen
      if (marker) marker.remove();
      marker = new maplibregl.Marker()
        .setLngLat(center)
        .addTo(map);
    }
  });
  
  // Panel schließen
  document.getElementById('closePanel').addEventListener('click', function() {
    document.getElementById('districtPanel').classList.add('hidden');
    if (marker) {
      marker.remove();
      marker = null;
    }
  });
  
  // Klick auf die Karte
  map.on('click', 'district-fill', function(e) {
    if (!e.features.length) return;
    var feature = e.features[0];
    lastClickedFeature = feature;
    
    // Center des angeklickten Features ermitteln
    var center = e.lngLat;
    
    // Marker setzen
    if (marker) marker.remove();
    marker = new maplibregl.Marker()
      .setLngLat(center)
      .addTo(map);
    
    // Panel mit Daten aktualisieren
    updateDistrictPanel(feature);
  });
  
  // Hover-Effekte
  map.on('mouseenter', 'district-fill', function() {
    map.getCanvas().style.cursor = 'pointer';
  });
  
  map.on('mouseleave', 'district-fill', function() {
    map.getCanvas().style.cursor = '';
  });
}

/***********************
 * Hilfsfunktionen
 ***********************/
function updateMapColors() {
  if (!geojsonData) return;
  
  geojsonData.features.forEach(function(feature) {
    var fillColor;
    
    if (currentParty === "Gewinner") {
      // Gewinner-Modus: Ermittle die stärkste Partei
      var winningParty = null, winningValue = 0;
      
      currentDataset.availableParties.forEach(function(key) {
        if (feature.properties[key]) {
          var val = parseFloat(feature.properties[key].replace(',', '.'));
          if (val > winningValue) {
            winningValue = val;
            winningParty = key;
          }
        }
      });
      
      fillColor = partyColors[winningParty] || '#999999';
    } else if (currentParty === "Wahlbeteiligung") {
      // Wahlbeteiligung anzeigen
      if (feature.properties.Wahlbeteiligung) {
        var val = parseFloat(feature.properties.Wahlbeteiligung.replace(',', '.'));
        var range = currentDataset.partyRanges.Wahlbeteiligung;
        var norm = (val - range.min) / (range.max - range.min);
        norm = Math.max(0, Math.min(norm, 1));
        fillColor = interpolateColor("#E0E0E0", "#a3512b", norm);
      } else {
        fillColor = '#999999';
      }
    } else {
      // Spezifische Partei anzeigen
      if (feature.properties[currentParty]) {
        var val = parseFloat(feature.properties[currentParty].replace(',', '.'));
        var range = currentDataset.partyRanges[currentParty];
        var norm = (val - range.min) / (range.max - range.min);
        norm = Math.max(0, Math.min(norm, 1));
        fillColor = interpolateColor("#E0E0E0", partyColors[currentParty], norm);
      } else {
        fillColor = '#999999';
      }
    }
    
    feature.properties.fillColor = fillColor;
  });
  
  if (map.getSource('geojson-layer')) {
    map.getSource('geojson-layer').setData(geojsonData);
  }
}

function updatePartySelect() {
  var select = document.getElementById('partySelect');
  select.innerHTML = '';
  
  // Gewinner-Option immer hinzufügen
  var gewinner = document.createElement('option');
  gewinner.value = "Gewinner";
  gewinner.textContent = "Gewinner";
  gewinner.selected = currentParty === "Gewinner";
  select.appendChild(gewinner);
  
  // Wahlbeteiligung-Option hinzufügen
  var beteiligung = document.createElement('option');
  beteiligung.value = "Wahlbeteiligung";
  beteiligung.textContent = "Wahlbeteiligung";
  beteiligung.selected = currentParty === "Wahlbeteiligung";
  select.appendChild(beteiligung);
  
  // Parteien hinzufügen
  currentDataset.availableParties.forEach(function(key) {
    var option = document.createElement('option');
    option.value = key;
    option.textContent = partyDisplayNames[key] || key;
    option.selected = currentParty === key;
    select.appendChild(option);
  });
}

function updateDistrictPanel(feature) {
  var panel = document.getElementById('districtPanel');
  var districtName = feature.properties.UWB || "Unbekannter Bezirk";
  
  // Bezirksnamen setzen
  document.getElementById('districtName').textContent = districtName;
  
  // Panel anzeigen
  panel.classList.remove('hidden');
  
  // Daten für das Diagramm vorbereiten
  createDonutChart(feature);
}

function createDonutChart(feature) {
  var chartContainer = document.getElementById('chartContainer');
  chartContainer.innerHTML = ''; // Container leeren
  
  // amCharts Donut-Chart erstellen
  am5.ready(function() {
    // Chart-Instanz entfernen, falls vorhanden
    if (chart) {
      chart.dispose();
    }
    
    // Root erstellen
    var root = am5.Root.new(chartContainer);
    root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root)]);
    
    // Chart erstellen
    chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.horizontalLayout,
        innerRadius: am5.percent(50)
      })
    );
    
    // Daten für das Diagramm vorbereiten
    var data = [];
    currentDataset.availableParties.forEach(function(key) {
      if (feature.properties[key]) {
        var val = parseFloat(feature.properties[key].replace(',', '.'));
        data.push({
          party: partyDisplayNames[key] || key,
          value: val * 100, // In Prozent umrechnen
          color: partyColors[key]
        });
      }
    });
    
    // Daten nach Wert sortieren (größter zuerst)
    data.sort((a, b) => b.value - a.value);
    
    // Series erstellen
    var series = chart.series.push(
      am5percent.PieSeries.new(root, {
        name: "Series",
        valueField: "value",
        categoryField: "party",
        alignLabels: false
      })
    );
    
    // Labels anpassen
    series.labels.template.set("visible", false);
    series.ticks.template.set("visible", false);
    
    // Tooltip anpassen
    series.slices.template.tooltipText = "{category}: {value.formatNumber('#.#')}%";
    
    // Farben setzen
    series.slices.template.adapters.add("fill", function(fill, target) {
      return am5.color(target.dataItem.dataContext.color);
    });
    
    // Daten setzen
    series.data.setAll(data);
    
    // Animationen starten
    series.appear(1000, 100);
  });
}

function getCenterFromGeometry(geometry) {
  if (geometry.type === "Polygon") {
    var coords = geometry.coordinates[0];
    var sumX = 0, sumY = 0;
    
    coords.forEach(function(coord) {
      sumX += coord[0];
      sumY += coord[1];
    });
    
    return [sumX / coords.length, sumY / coords.length];
  }
  
  return [13.40, 52.52]; // Fallback auf Berlin-Mitte
}

function interpolateColor(color1, color2, factor) {
  var result = color1;
  
  try {
    var c1 = hexToRgb(color1);
    var c2 = hexToRgb(color2);
    
    if (c1 && c2) {
      var r = Math.round(c1.r + (c2.r - c1.r) * factor);
      var g = Math.round(c1.g + (c2.g - c1.g) * factor);
      var b = Math.round(c1.b + (c2.b - c1.b) * factor);
      
      result = "rgb(" + r + ", " + g + ", " + b + ")";
    }
  } catch (e) {
    console.error("Fehler bei der Farbinterpolation:", e);
  }
  
  return result;
}

function hexToRgb(hex) {
  // Einfache Umrechnung von Hex zu RGB
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });
  
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

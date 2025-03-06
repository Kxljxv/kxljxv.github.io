const MapboxChoropleth = require('mapbox-choropleth');
let c = new MapboxChoropleth({
    tableUrl: 'https://gist.githubusercontent.com/stevage/088fd8edab66157e1a307f521e38ecca/raw/46d01d54a7d95cac1ad88347aa910b5de3946b3e/elb.csv',
    tableNumericField: 'Australian Labor Party Percentage',
    tableIdField: 'DivisionNm',
    geometryUrl: 'mapbox://stevage.7ux6xzbz',
    geometryIdField: 'ELECT_DIV',
    sourceLayer: 'ELB',
    binCount: 20,
    colorScheme: 'Spectral',
    legendElement: '#legend'
 }).addTo(map);

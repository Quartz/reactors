// Dependencies
var d3 = require('d3');
var request = require('d3-request');
require("d3-geo-projection")(d3);
var topojson = require('topojson');
var _ = require('lodash');

var fm = require('./fm');
var throttle = require('./throttle');
var features = require('./detectFeatures')();

// Globals
var DEFAULT_WIDTH = 940;
var MOBILE_THRESHOLD = 600;
var PLAYBACK_SPEED = 400;
var FIRST_YEAR = 1955;
var LAST_YEAR = 2015;

var bordersData = null;
var reactorsData = null;
var yearElement = null;
var playButtonElement = null;

var isMobile = false;
var playbackYear = FIRST_YEAR;
var isPlaying = false;
var hasPlayed = false;
var restarting = false;

function init() {
  request.json('data/borders-topo.json', function(error, data) {
    bordersData = topojson.feature(data, data['objects']['ne_110m_admin_0_countries']);

    request.json('data/reactors.json', function(error, data) {
      reactorsData = data;

      render();
      $(window).resize(throttle(onResize, 250));
    });
  });
}

function onResize() {
  if (!isPlaying) {
    render();
  }
}

function onPlayButtonClicked() {
  d3.event.preventDefault();

  if (playbackYear == LAST_YEAR) {
    restarting = true;
  }

  playbackYear = FIRST_YEAR;
  isPlaying = true;
  render();
}

function render() {
  var width = $('#interactive-content').width();

  if (width <= MOBILE_THRESHOLD) {
      isMobile = true;
  } else {
      isMobile = false;
  }

  if (isPlaying) {
    // Don't immediately advance if just showing first year
    if (restarting) {
      restarting = false;
    } else {
      playbackYear = playbackYear + 1;

      if (playbackYear == LAST_YEAR) {
        isPlaying = false;
        hasPlayed = true;
      }
    }
  }

  renderMap({
    container: '#map',
    width: width,
    borders: bordersData,
    sites: reactorsData['sites'],
    year: reactorsData['years'][playbackYear]
  });

  // Resize
  fm.resize()

  if (isPlaying) {
    _.delay(render, PLAYBACK_SPEED);
  }
}

/*
 * Render a map.
 */
function renderMap(config) {
    /*
     * Setup
     */
    var aspectRatio = 5 / 2.6;
    var defaultScale = 180;

    var margins = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    };

    // Calculate actual chart dimensions
    var width = config['width'];
    var height = width / aspectRatio;

    var chartWidth = width - (margins['left'] + margins['right']);
    var chartHeight = height - (margins['top'] + margins['bottom']);

    var mapCenter = [10, 13];
    var scaleFactor = chartWidth / DEFAULT_WIDTH;
    var mapScale = scaleFactor * defaultScale;

    var projection = d3.geo.robinson()
      .center(mapCenter)
      .translate([width / 2, height / 2])
      .scale(mapScale);

    var geoPath = d3.geo.path()
      .projection(projection)

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    /*
     * Create the root SVG element.
     */
    var chartWrapper = containerElement.append('div')
      .attr('class', 'graphic-wrapper');

    var chartElement = chartWrapper.append('svg')
      .attr('width', chartWidth + margins['left'] + margins['right'])
      .attr('height', chartHeight + margins['top'] + margins['bottom'])
      .append('g')
      .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

    /*
     * Create geographic elements.
     */
    var borders = chartElement.append('g')
      .attr('class', 'borders');

    borders.selectAll('path')
      .data(config['borders']['features'])
      .enter().append('path')
        .attr('id', function(d) {
          return d['id'];
        })
        .attr('d', geoPath);

    var reactors = chartElement.append('g')
      .attr('class', 'reactors');

    _.each(['s', 'o', 'c'], function(mode) {
      var group = reactors.append('g')
        .attr('class', mode);

      group.selectAll('circle')
        .data(config['year'][mode])
        .enter().append('circle')
          .attr('data-name', function(d) { return d; })
          .attr('r', isMobile ? 2 : 3)
          .attr('cx', function(d) {
            var coords = config['sites'][d];

            return projection(coords)[0];
          })
          .attr('cy', function(d) {
            var coords = config['sites'][d];

            return projection(coords)[1];
          })
    });

    // Year display
    chartElement.append('text')
      .attr('class', 'year')
      .attr('transform', 'translate(' + projection([-20, 0]) + ') scale(' + scaleFactor + ')')
      .text(playbackYear)

    // Play button
    var controls = chartElement.append('g')
      .attr('class', 'controls')
      .attr('transform', 'translate(' + projection([-15, -12]) + ') scale(' + scaleFactor + ')')

    if (!isPlaying) {
      controls.append('polygon')
        .attr('points', '0,0 0,40 40,20')

      controls.append('text')
        .attr('dx', 50)
        .attr('dy', 35)
        .text('Play')

      var nw = projection([-20, -9]);
      var se = projection([35, -26]);

      // Click area
      chartElement.append('rect')
        .attr('class', 'play')
        .attr('transform', 'translate(' + nw + ')')
        .attr('width', se[0] - nw[0])
        .attr('height', se[1] - nw[1])
        .attr('rx', isMobile ? 3 : 5)
        .attr('ry', isMobile ? 3 : 5)
        .on('click', onPlayButtonClicked);
    }
}

$(document).ready(function () {
  init();
});

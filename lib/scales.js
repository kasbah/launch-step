'use strict';

var kebabCase = require('lodash.kebabcase');
var tonalMidi = require('tonal-midi');
var tonalScale = require('tonal-scale');
var tonalRange = require('tonal-range');

var scaleFromKebab = {};
tonalScale.names().forEach(function (n) {
    return scaleFromKebab[kebabCase(n)] = n;
});

exports.getAllNotes = function (scaleKebab, rootNote) {
    var name = scaleFromKebab[scaleKebab];
    var tonal = tonalMidi.fromMidi(rootNote);
    var scale = tonalScale.build(name, tonal);
    var range = tonalRange.scaleRange(scale, '127 0');
    return range.map(tonalMidi.toMidi);
};

exports.scaleFromKebab = scaleFromKebab;
exports.supportedScales = Object.keys(scaleFromKebab).sort();
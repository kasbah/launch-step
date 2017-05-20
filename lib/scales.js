'use strict';

var kebabCase = require('lodash.kebabcase');
var tonalMidi = require('tonal-midi');
var tonalScale = require('tonal-scale');
var tonalRange = require('tonal-range');

var scaleFromKebab = {};
tonalScale.names().forEach(function (n) {
    return scaleFromKebab[kebabCase(n)] = n;
});

function getAllNotes(scaleOption, rootNote) {
    if (typeof scaleOption === 'string') {
        var name = scaleFromKebab[scaleOption];
        var tonal = tonalMidi.fromMidi(rootNote);
        var scale = tonalScale.get(name, tonal);
    } else {
        var scale = scaleOption;
    }
    var range = tonalRange.scaleRange(scale, '127 0');
    return range.map(tonalMidi.toMidi);
}

exports.getAllNotes = getAllNotes;

exports.scaleFromKebab = scaleFromKebab;
exports.supportedScales = Object.keys(scaleFromKebab).sort();
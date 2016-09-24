'use strict'
const kebabCase  = require('lodash.kebabcase')
const tonalMidi  = require('tonal-midi')
const tonalScale = require('tonal-scale')
const tonalRange = require('tonal-range')

const scaleFromKebab = {}
tonalScale.names().forEach(n => scaleFromKebab[kebabCase(n)] = n)

exports.getAllNotes = function(scaleKebab, rootNote) {
    const name  = scaleFromKebab[scaleKebab]
    const tonal = tonalMidi.fromMidi(rootNote)
    const scale = tonalScale.build(name, tonal)
    const range = tonalRange.scaleRange(scale, '127 0')
    return range.map(tonalMidi.toMidi)
}

exports.scaleFromKebab  = scaleFromKebab
exports.supportedScales = Object.keys(scaleFromKebab).sort()

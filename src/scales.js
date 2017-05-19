'use strict'
const kebabCase  = require('lodash.kebabcase')
const tonalMidi  = require('tonal-midi')
const tonalScale = require('tonal-scale')
const tonalRange = require('tonal-range')

const scaleFromKebab = {}
tonalScale.names().forEach(n => scaleFromKebab[kebabCase(n)] = n)

function getAllNotes(scaleOption, rootNote) {
    if (typeof(scaleOption) === 'string') {
        const name  = scaleFromKebab[scaleOption]
        const tonal = tonalMidi.fromMidi(rootNote)
        var scale = tonalScale.get(name, tonal)
    } else {
        var scale = scaleOption
    }
    const range = tonalRange.scaleRange(scale, '127 0')
    return range.map(tonalMidi.toMidi)
}

exports.getAllNotes = getAllNotes

exports.scaleFromKebab  = scaleFromKebab
exports.supportedScales = Object.keys(scaleFromKebab).sort()

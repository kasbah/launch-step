const tonalScales = require('tonal-scales')
const tonalRanges = require('tonal-rangess')
function getNotes(scale, root, n) {
    return tonalRanges.range(tonalScales.scale(scale).join(' '), 0, 127)
}

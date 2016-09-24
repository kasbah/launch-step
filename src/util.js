'use strict'
function emptyGrid(i, j, defaultValue) {
    return Array(i).fill().map(() => Array(j).fill(defaultValue))
}

exports.emptyGrid = emptyGrid

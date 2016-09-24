'use strict'

function emptyVector(i, defaultValue) {
    return Array(i).fill(defaultValue)
}

function emptyGrid(i, j, defaultValue) {
    return emptyVector(i).map(emptyVector)
}

exports.emptyGrid = emptyGrid
exports.emptyVector = emptyVector

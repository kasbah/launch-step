'use strict';

function emptyGrid(i, j, defaultValue) {
    return Array(i).fill().map(function () {
        return Array(j).fill(defaultValue);
    });
}

exports.emptyGrid = emptyGrid;
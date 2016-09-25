'use strict';

var redux = require('redux');

var scales = require('./scales');
var util = require('./util');

module.exports = function (options) {
    function initState() {
        var noteRows = scales.getAllNotes(options.scale, options.root);
        //align to columns in a page (8)
        var stepsInGrid = options.numberOfSteps + 8 - options.numberOfSteps % 8;
        var stepGrid = emptyStepGrid(stepsInGrid, noteRows.length);
        return {
            noteRows: noteRows,
            playing: noteRows.map(function () {
                return false;
            }),
            velocityBrush: 127,
            stepGrid: stepGrid,
            step: 0,
            numberOfSteps: options.numberOfSteps,
            stepsInGrid: stepsInGrid,
            row: 0,
            duration: 400, //ms
            tempo: options.tempo === 'ext' ? 0 : options.tempo,
            getOffsets: function getOffsets() {
                return [Math.floor(this.step / 8) * 8, rowToNoteRow(this.noteRows, Math.floor(this.row / 8) * 8)];
            }
        };
    }

    function reducer(state, action) {
        if (state == null) {
            state = initState();
        }
        switch (action.type) {
            case 'reset':
                return initState();
            case 'toggle-button':
                var x = action.value[0];
                var y = action.value[1];
                if (state.stepGrid[x][y] == state.velocityBrush) {
                    state.stepGrid[x][y] = 0;
                } else {
                    state.stepGrid[x][y] = state.velocityBrush;
                }
                return state;
            case 'set-playing':
                {
                    var _y = action.value;
                    state.playing[_y] = true;
                    return state;
                }
            case 'set-off':
                {
                    var _y2 = action.value;
                    state.playing[_y2] = false;
                    return state;
                }
            case 'set-step':
                if (state.step < state.numberOfSteps) {
                    state.step = action.value;
                }
                return state;
            case 'set-tempo':
                state.tempo = action.value;
                return state;
            case 'clear-grid':
                state.stepGrid = emptyStepGrid(state.stepsInGrid, state.noteRows.length);
                return state;
            case 'page-up':
                {
                    var row = state.row - 8;
                    if (state.noteRows[rowToNoteRow(state.noteRows, row)] == null) {
                        return state;
                    }
                    state.row = row;
                    return state;
                }
            case 'page-down':
                {
                    var _row = state.row + 8;
                    if (state.noteRows[rowToNoteRow(state.noteRows, _row)] == null) {
                        return state;
                    }
                    state.row = _row;
                    return state;
                }
            case 'increment-steps':
                {
                    var n = action.value;
                    var numberOfSteps = state.numberOfSteps + n;
                    if (state.stepGrid.length < numberOfSteps) {
                        state.stepGrid = state.stepGrid.concat(util.emptyGrid(8, state.noteRows.length, 0));
                        state.stepsInGrid += 8;
                    }
                    state.numberOfSteps = numberOfSteps;
                    return state;
                }
            case 'decrement-steps':
                {
                    var _n = action.value;
                    var _numberOfSteps = state.numberOfSteps - _n;
                    if (_numberOfSteps >= 1) {
                        state.numberOfSteps = _numberOfSteps;
                        state.step = Math.min(_numberOfSteps - 1, state.step);
                    }
                    return state;
                }
            case 'change-velocity-brush':
                {
                    var values = [20, 80, 127];
                    var current = values.indexOf(state.velocityBrush);
                    var next = current + 1;
                    if (next >= values.length) {
                        next = 0;
                    }
                    state.velocityBrush = values[next];
                    return state;
                }
        }
    }

    function emptyStepGrid(numberOfSteps, rows) {
        return util.emptyGrid(numberOfSteps, rows, 0);
    }

    function rowToNoteRow(noteRows, row) {
        return noteRows.indexOf(options.root) - 7 + row;
    }

    return redux.createStore(reducer);
};
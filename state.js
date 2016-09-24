'use strict'
const redux = require('redux')

const scales = require('./scales')
const util   = require('./util')

module.exports = function (options) {
    function initState() {
        const noteRows = scales.getAllNotes(options.scale, options.root)
        const stepGrid = emptyStepGrid(options.numberOfSteps, noteRows.length)
        const playing  = noteRows.map(() => false)
        return {
            noteRows      : noteRows,
            stepGrid      : stepGrid,
            playing       : playing,
            step          : 0,
            numberOfSteps : options.numberOfSteps,
            row           : 0,
            duration      : 400, //ms
            tempo         : options.tempo === 'ext' ? 0 : options.tempo,
            getOffsets: function() {
                return [
                    Math.floor(this.step / 8) * 8,
                    rowToNoteRow(this.noteRows, Math.floor(this.row / 8) * 8)
                ]
            }
       }
    }

    function reducer(state, action) {
        if (state == null) {
            state = initState()
        }
        switch(action.type) {
            case 'toggle-button':
                const x = action.value[0]
                const y = action.value[1]
                state.stepGrid[x][y] = !state.stepGrid[x][y]
                return state
            case 'set-playing': {
                const y = action.value
                state.playing[y] = true
                return state
            }
            case 'set-off': {
                const y = action.value
                state.playing[y] = false
                return state
            }
            case 'set-step':
                state.step = action.value
                return state
            case 'set-tempo':
                state.tempo = action.value
                return state
            case 'clear-grid':
                state.stepGrid = emptyStepGrid(state.numberOfSteps, state.noteRows.length)
                return state
            case 'page-up': {
                const row = state.row - 8
                if (state.noteRows[rowToNoteRow(state.noteRows, row)] == null) {
                    return state
                }
                state.row = row
                return state
            }
            case 'page-down': {
                const row = state.row + 8
                if (state.noteRows[rowToNoteRow(state.noteRows, row)] == null) {
                    return state
                }
                state.row = row
                return state
            }
            case 'increment-steps': {
                const n = action.value
                state.stepGrid = state.stepGrid.concat(
                    util.emptyGrid(n, state.noteRows.length, false))
                state.numberOfSteps += n
                return state
            }
        }
    }

    function emptyStepGrid(numberOfSteps, rows) {
        return util.emptyGrid(numberOfSteps, rows, false)
    }


    function rowToNoteRow(noteRows, row) {
        return noteRows.indexOf(options.root) - 7 + row
    }

    return redux.createStore(reducer)
}

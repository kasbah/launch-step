const redux = require('redux')

const scales = require('./scales')
const util   = require('./util')

module.exports = function (options) {
    function initState() {
        const noteRows = scales.getAllNotes(options.scale, options.root)
        const stepGrid = emptyStepGrid(noteRows.length)
        return {
            noteRows : noteRows,
            stepGrid : stepGrid,
            step     : 0,
            row      : 0,
            duration : 400, //ms
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
            case 'set-step':
                state.step = action.value
                return state
            case 'clear-grid':
                state.stepGrid = emptyStepGrid(state.noteRows.length)
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
        }
    }

    function emptyStepGrid(rows) {
        return util.emptyGrid(options.steps, rows, false)
    }


    function rowToNoteRow(noteRows, row) {
        return noteRows.indexOf(options.root) - 7 + row
    }

    return redux.createStore(reducer)
}


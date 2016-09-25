#!/usr/bin/env node
'use strict'
require("babel-polyfill")
const midi          = require('midi')
const midiLaunchpad = require('midi-launchpad')
const StepSequencer = require('step-sequencer')
const tonalRange    = require('tonal-range')
const {noteOn, noteOff} = require('midi-help')

const {red, green, yellow, orange, off} = midiLaunchpad.colors

const util = require('./util')
const scales = require('./scales')

const options = require('./options')
const store = require('./state')(options)

const midiOutput = new midi.output()
midiOutput.openVirtualPort('launch-step output')

if (options.tempo === 'ext') {
    const midiInput = new midi.input()
    //don't ignore midi clock messages
    midiInput.ignoreTypes(true, false, true)
    midiInput.openVirtualPort('launch-step clock input')
    const deltas = []
    midiInput.on('message', (deltaTime, message)=> {
        if (deltaTime > 0.00000) {
            deltas.push(deltaTime)
        }

        const total = deltas.reduce((a, b) => a + b, 0)
        const bpm   = Math.round((600 / 24) / (total / deltas.length)) / 10
        store.dispatch({type: 'set-tempo', value: bpm})

        if (deltas.length >= 96) {
            deltas.shift()
        }
    })
}


const stepSequencer = new StepSequencer(options.tempo * options.stepsPerBeat, options.numberOfSteps)

//undefined = auto-connect, false = disable animation
const connection = midiLaunchpad.connect(undefined, false)

connection.on('ready', launchpad => {
    process.on('SIGINT', () => {
        stepSequencer.stop()
        const state = store.getState()
        //turn off any playing notes
        state.playing.forEach((playing, y) => {
            if (playing) {
                const note = state.noteRows[y]
                midiOutput.sendMessage(noteOff(note, 0))
                store.dispatch({type: 'set-off', y})
            }
        })
        launchpad.clear()
        process.exit()
    })

    function renderLeds() {
        const state = store.getState()
        const canvas = util.emptyGrid(8, 8, off)
        const [offsetX, offsetY] = state.getOffsets()
        const step = state.step - offsetX
        const page = state.stepGrid.slice(offsetX, offsetX + 8)
            .map(column => column.slice(offsetY, offsetY + 8))
        const endIndex = state.numberOfSteps - offsetX
        //draw all the squares
        canvas.forEach((row, y) => {
            page.forEach((values, x) => {
                const velocity = values[y]
                const level = ['low', 'medium', 'high'][Math.round((velocity/127) * 2)]
                const color = x < endIndex ? green : red
                row[x] = values[y] ? color[level] : off
            })
        })
        // draw an end of sequence marker if sequence ends within page
        if (endIndex < 8) {
            canvas.forEach((row, y) => {
                row[endIndex] = page[endIndex][y] ? yellow.medium : red.medium
            })
        }
        //draw the cursor
        canvas.forEach((row, y) => {
            row[step] = page[step][y] ? orange.high : yellow.high
        })
        //set the LEDs on the cursor keys according to page level
        const topRow = Array(8).fill(off)
        const level = state.row / 8
        if (level !== 0) {
            const c = [green.high, yellow.high, orange.high, red.high, red.high][Math.abs(level) - 1]
            if (Math.abs(level) > 4) {
                topRow[0] = c
                topRow[1] = c
            } else if (level < 0) {
                topRow[0] = c
            } else {
                topRow[1] = c
            }
        }
        //draw velocity brush satus
        const c = [green.low, green.medium, green.high][Math.round((state.velocityBrush/127 * 2))]
        topRow[5] = c
        //session button red
        topRow[4] = red.high
        canvas.push(topRow)
        launchpad.renderColors(canvas)
    }

    function renderMidi() {
        const state = store.getState()
        state.stepGrid[state.step].forEach((velocity, y) => {
            if (velocity) {
                const note = state.noteRows[y]
                midiOutput.sendMessage(noteOn(note, velocity))
                setTimeout(() => {
                    midiOutput.sendMessage(noteOff(note, velocity))
                    store.dispatch({type: 'set-off', value:y})
                }, state.duration)
                store.dispatch({type: 'set-playing', value:y})
            }
        })
    }

    function renderSequencer() {
        stepSequencer.removeAllListeners()
        const state = store.getState()
        stepSequencer.setTempo(state.tempo * options.stepsPerBeat)
        stepSequencer.setSequence(state.numberOfSteps, [])
        registerSequence(state.numberOfSteps)
    }

    function registerSequence(numberOfSteps) {
        for (let step = 0; step < numberOfSteps; step++) {
            stepSequencer.on(step, () => {
                store.dispatch({type: 'set-step', value: step})
                renderMidi()
                renderLeds()
            })
        }
    }
    registerSequence(options.numberOfSteps)

    launchpad.on('press', button => {
        if(!button.special) {
            const state = store.getState()
            const [offsetX, offsetY] = state.getOffsets()
            const x = button.x + offsetX
            const y = button.y + offsetY
            store.dispatch({type:'toggle-button', value: [x,y]})
        } else {
            switch(button.special[0]) {
                case 'user 1':
                    store.dispatch({type:'change-velocity-brush'})
                    break
                case 'session':
                    store.dispatch({type:'reset'})
                    renderSequencer()
                    break
                case 'down':
                    store.dispatch({type:'page-down'})
                    break
                case 'up':
                    store.dispatch({type:'page-up'})
                    break
                case 'left':
                    store.dispatch({type:'decrement-steps', value: 1})
                    renderSequencer()
                    break
                case 'right':
                    store.dispatch({type:'increment-steps', value: 1})
                    renderSequencer()
                    break
            }
        }
        renderLeds()
    })

    stepSequencer.play()

})


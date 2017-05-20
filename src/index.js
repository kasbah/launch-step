#!/usr/bin/env node
'use strict'
require("babel-polyfill")
const midi          = require('midi')
const midiLaunchpad = require('midi-launchpad')
const tonalRange    = require('tonal-range')
const {noteOn, noteOff} = require('midi-help')

const {red, green, yellow, orange, off} = midiLaunchpad.colors

const util = require('./util')
const scales = require('./scales')

const options = require('./options')
const store = require('./state')(options)
store.dispatch({type:'reset'})

const midiOutput = new midi.output('launch-step', true);
midiOutput.openVirtualPort('launch-step output')

//undefined = auto-connect, false = disable animation
const connection = midiLaunchpad.connect(undefined, false)

connection.on('ready', launchpad => {
    process.on('SIGINT', () => {
        const state = store.getState()
        //turn off any playing notes
        state.playing.forEach((playing, y) => {
            if (playing) {
                const note = state.noteRows[y]
                midiOutput.sendMessage(noteOff(note, 0, options.channel - 1))
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
                let level
                if (velocity === 127) {
                    level = 'high'
                } else if (velocity >= 100) {
                    level = 'medium'
                } else {
                    level = 'low'
                }
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
        //user1 is green
        topRow[5] = green.high
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
                midiOutput.sendMessage(noteOn(note, velocity, options.channel - 1))
                setTimeout(() => {
                    midiOutput.sendMessage(noteOff(note, velocity, options.channel - 1))
                    store.dispatch({type: 'set-off', value:y})
                }, state.duration)
                store.dispatch({type: 'set-playing', value:y})
            }
        })
    }

    launchpad.on('press', button => {
        if(!button.special) {
            const state              = store.getState()
            const [offsetX, offsetY] = state.getOffsets()
            const x                  = button.x + offsetX
            const y                  = button.y + offsetY
            const velocity           = state.stepGrid[x][y]
            if (velocity === 0) {
                store.dispatch({type:'set-velocity', value: [x,y, 127]})
                let initialTime = 1
                const t = setInterval(a => {
                    if (initialTime > 0) {
                        initialTime -= 1
                    } else {
                        const state    = store.getState()
                        const velocity = state.stepGrid[x][y]
                        if (velocity > 17) {
                            store.dispatch({type:'set-velocity', value: [x, y, velocity - 10]})
                        }
                    }
                }, 200)
                store.dispatch({type:'set-button-timer', value: [x,y, t]})
            } else {
                store.dispatch({type:'set-velocity', value: [x,y, 0]})
            }
        } else {
            switch(button.special[0]) {
                case 'user 1':
                    store.dispatch({type:'set-step', value: 0})
                    if (options.tempo !== 'ext') {
                        setTimer()
                    }
                    break
                case 'session':
                    store.dispatch({type:'reset'})
                    if (options.tempo !== 'ext') {
                        setTimer()
                    }
                    break
                case 'down':
                    store.dispatch({type:'page-down'})
                    break
                case 'up':
                    store.dispatch({type:'page-up'})
                    break
                case 'left':
                    store.dispatch({type:'decrement-steps', value: 1})
                    break
                case 'right':
                    store.dispatch({type:'increment-steps', value: 1})
                    break
            }
        }
        renderLeds()
    })

    launchpad.on('release', button => {
        if(!button.special) {
            const state              = store.getState()
            const [offsetX, offsetY] = state.getOffsets()
            const x                  = button.x + offsetX
            const y                  = button.y + offsetY
            store.dispatch({type:'set-button-timer', value: [x, y, null]})
        }
    })

    let count = 0
    function beat() {
        count += 1
        //beat clock is 24 per quarter i.e. per beat
        if (count >= (24 / options.stepsPerBeat)) {
            count = 0
            const state = store.getState()
            let step = state.step + 1
            if (step >= state.numberOfSteps) {
                step -= state.numberOfSteps
            }
            store.dispatch({type: 'set-step', value: step})
            renderMidi()
            renderLeds()
        }
    }

    let timer
    function setTimer() {
        clearInterval(timer)
        if (options.tempo !== 'ext') {
            timer = setInterval(beat, 1000 / (options.tempo / 60) / 24)
        }
    }

    if (options.tempo !== 'ext') {
        setTimer()
    } else {
        const midiInput = new midi.input()
        //don't ignore midi clock messages
        midiInput.ignoreTypes(true, false, true)
        midiInput.openVirtualPort('launch-step clock input')
        midiInput.on('message', beat)
    }

})


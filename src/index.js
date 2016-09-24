#!/usr/bin/env node
'use strict'
require("babel-polyfill")
const midi          = require('midi')
const midiLaunchpad = require('midi-launchpad')
const argv          = require('argv')
const StepSequencer = require('step-sequencer')
const tonalMidi     = require('tonal-midi')
const tonalRange    = require('tonal-range')
const {noteOn, noteOff} = require('midi-help')

const {red, green, yellow, orange, off} = midiLaunchpad.colors

const util = require('./util')
const scales = require('./scales')

const args = argv.option([
    {
        name: 'tempo',
        short: 't',
        type: 'string',
        description: 'Tempo in beats per minute. The default is 120. Can be set to "ext" to use an external midi clock signal.',
        example: "'launch-step -t 133.2' or 'launch-step --tempo=133.2'"
    },
    {
        name: 'steps-per-beat',
        short: 'p',
        type: 'int',
        description: 'Number of steps per beat. The default is 2.',
        example: "'launch-step -p 4' or 'launch-step --steps-per-beat=4'"
    },
    {
        name: 'number-of-steps',
        short: 'n',
        type: 'int',
        description: 'Number of steps in the sequence. The default is 8.',
        example: "'launch-step -n 12' or 'launch-step --number-of-steps=12'"
    },
    {
        name: 'scale',
        short: 's',
        type: 'string',
        description: `The scale to apply to the rows. The default is 'major-pentatonic'. Options are: \n\n ${scales.supportedScales.join('\n')}`,
        example: "'launch-step -s major' or 'launch-step --scale=major'"
    },
    {
        name: 'root-note',
        short: 'r',
        type: 'string',
        description: "The note to start the scale from. Can be a MIDI note number (0-127) or a note name like 'A1', 'Bb1' or 'C#1'. The default is MIDI note 60 (C4).",
        example: "'launch-step -r A4' or 'launch-step --root-note=A4'"
    },
]).run()

const options = {
    tempo         : args.options.tempo === 'ext' ? 'ext' : Number(args.options.tempo || 120),
    numberOfSteps : args.options['number-of-steps'] || 8,
    stepsPerBeat  : args.options['steps-per-beat'] || 2,
    scale         : args.options.scale || 'major-pentatonic',
    root          : tonalMidi.toMidi(args.options['root-note'] || 60),
}

if (isNaN(options.root) || options.root == null) {
    console.error(`Invalid root note '${args.options['root-note']}' given. Should be a MIDI note number like 64 or a note name like A3, C#3 or Eb2.`)
    process.exit(1)
}
if (!(scales.supportedScales.includes(options.scale))) {
    console.error(`No scale named '${options.scale}', run 'launch-step --help'for a list of available scales.`)
    process.exit(1)
}
console.log(`Starting ${options.numberOfSteps} step sequencer at ${options.tempo} bpm, ${options.stepsPerBeat} steps per beat, using ${options.scale} scale starting with MIDI note ${options.root} (${tonalMidi.fromMidi(options.root)}).`)


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
        topRow[7] = c
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
                case 'mixer':
                    store.dispatch({type:'change-velocity-brush'})
                    break
                case 'session':
                    store.dispatch({type:'clear-grid'})
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

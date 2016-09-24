#!/usr/bin/env node

'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

require("babel-polyfill");
var midi = require('midi');
var midiLaunchpad = require('midi-launchpad');
var argv = require('argv');
var StepSequencer = require('step-sequencer');
var tonalMidi = require('tonal-midi');
var tonalRange = require('tonal-range');

var _require = require('midi-help');

var noteOn = _require.noteOn;
var noteOff = _require.noteOff;
var _midiLaunchpad$colors = midiLaunchpad.colors;
var red = _midiLaunchpad$colors.red;
var green = _midiLaunchpad$colors.green;
var yellow = _midiLaunchpad$colors.yellow;
var orange = _midiLaunchpad$colors.orange;
var off = _midiLaunchpad$colors.off;


var util = require('./util');
var scales = require('./scales');

var args = argv.option([{
    name: 'tempo',
    short: 't',
    type: 'string',
    description: 'Tempo in beats per minute. The default is 120. Can be set to "ext" to use an external midi clock signal.',
    example: "'launch-step -t 133.2' or 'launch-step --tempo=133.2'"
}, {
    name: 'steps-per-beat',
    short: 'p',
    type: 'int',
    description: 'Number of steps per beat. The default is 2.',
    example: "'launch-step -p 4' or 'launch-step --steps-per-beat=4'"
}, {
    name: 'number-of-steps',
    short: 'n',
    type: 'int',
    description: 'Number of steps in the sequence. The default is 8.',
    example: "'launch-step -n 12' or 'launch-step --number-of-steps=12'"
}, {
    name: 'scale',
    short: 's',
    type: 'string',
    description: 'The scale to apply to the rows. The default is \'major-pentatonic\'. Options are: \n\n ' + scales.supportedScales.join('\n'),
    example: "'launch-step -s major' or 'launch-step --scale=major'"
}, {
    name: 'root-note',
    short: 'r',
    type: 'string',
    description: "The note to start the scale from. Can be a MIDI note number (0-127) or a note name like 'A1', 'Bb1' or 'C#1'. The default is MIDI note 60 (C4).",
    example: "'launch-step -r A4' or 'launch-step --root-note=A4'"
}]).run();

var options = {
    tempo: args.options.tempo === 'ext' ? 'ext' : Number(args.options.tempo || 120),
    numberOfSteps: args.options['number-of-steps'] || 8,
    stepsPerBeat: args.options['steps-per-beat'] || 2,
    scale: args.options.scale || 'major-pentatonic',
    root: tonalMidi.toMidi(args.options['root-note'] || 60)
};

if (isNaN(options.root) || options.root == null) {
    console.error('Invalid root note \'' + args.options['root-note'] + '\' given. Should be a MIDI note number like 64 or a note name like A3, C#3 or Eb2.');
    process.exit(1);
}
if (!(scales.supportedScales.indexOf(options.scale) !== -1)) {
    console.error('No scale named \'' + options.scale + '\', run \'launch-step --help\'for a list of available scales.');
    process.exit(1);
}
console.log('Starting ' + options.numberOfSteps + ' step sequencer at ' + options.tempo + ' bpm, ' + options.stepsPerBeat + ' steps per beat, using ' + options.scale + ' scale starting with MIDI note ' + options.root + ' (' + tonalMidi.fromMidi(options.root) + ').');

var store = require('./state')(options);

var midiOutput = new midi.output();
midiOutput.openVirtualPort('launch-step output');

if (options.tempo === 'ext') {
    (function () {
        var midiInput = new midi.input();
        //don't ignore midi clock messages
        midiInput.ignoreTypes(true, false, true);
        midiInput.openVirtualPort('launch-step clock input');
        var deltas = [];
        midiInput.on('message', function (deltaTime, message) {
            if (deltaTime > 0.00000) {
                deltas.push(deltaTime);
            }

            var total = deltas.reduce(function (a, b) {
                return a + b;
            }, 0);
            var bpm = Math.round(600 / 24 / (total / deltas.length)) / 10;
            store.dispatch({ type: 'set-tempo', value: bpm });

            if (deltas.length >= 96) {
                deltas.shift();
            }
        });
    })();
}

var stepSequencer = new StepSequencer(options.tempo * options.stepsPerBeat, options.numberOfSteps);

//undefined = auto-connect, false = disable animation
var connection = midiLaunchpad.connect(undefined, false);

connection.on('ready', function (launchpad) {
    process.on('SIGINT', function () {
        stepSequencer.stop();
        var state = store.getState();
        //turn off any playing notes
        state.playing.forEach(function (playing, y) {
            if (playing) {
                var note = state.noteRows[y];
                midiOutput.sendMessage(noteOff(note, 0));
                store.dispatch({ type: 'set-off', y: y });
            }
        });
        launchpad.clear();
        process.exit();
    });

    function renderLeds() {
        var state = store.getState();
        var canvas = util.emptyGrid(8, 8, off);

        var _state$getOffsets = state.getOffsets();

        var _state$getOffsets2 = _slicedToArray(_state$getOffsets, 2);

        var offsetX = _state$getOffsets2[0];
        var offsetY = _state$getOffsets2[1];

        var step = state.step - offsetX;
        var page = state.stepGrid.slice(offsetX, offsetX + 8).map(function (column) {
            return column.slice(offsetY, offsetY + 8);
        });
        var endIndex = state.numberOfSteps - offsetX;
        //draw all the squares
        canvas.forEach(function (row, y) {
            page.forEach(function (values, x) {
                var velocity = values[y];
                var level = ['low', 'medium', 'high'][Math.round(velocity / 127 * 2)];
                var color = x < endIndex ? green : red;
                row[x] = values[y] ? color[level] : off;
            });
        });
        // draw an end of sequence marker if sequence ends within page
        if (endIndex < 8) {
            canvas.forEach(function (row, y) {
                row[endIndex] = page[endIndex][y] ? yellow.medium : red.medium;
            });
        }
        //draw the cursor
        canvas.forEach(function (row, y) {
            row[step] = page[step][y] ? orange.high : yellow.high;
        });
        //set the LEDs on the cursor keys according to page level
        var topRow = Array(8).fill(off);
        var level = state.row / 8;
        if (level !== 0) {
            var _c = [green.high, yellow.high, orange.high, red.high, red.high][Math.abs(level) - 1];
            if (Math.abs(level) > 4) {
                topRow[0] = _c;
                topRow[1] = _c;
            } else if (level < 0) {
                topRow[0] = _c;
            } else {
                topRow[1] = _c;
            }
        }
        //draw velocity brush satus
        var c = [green.low, green.medium, green.high][Math.round(state.velocityBrush / 127 * 2)];
        topRow[7] = c;
        canvas.push(topRow);
        launchpad.renderColors(canvas);
    }

    function renderMidi() {
        var state = store.getState();
        state.stepGrid[state.step].forEach(function (velocity, y) {
            if (velocity) {
                (function () {
                    var note = state.noteRows[y];
                    midiOutput.sendMessage(noteOn(note, velocity));
                    setTimeout(function () {
                        midiOutput.sendMessage(noteOff(note, velocity));
                        store.dispatch({ type: 'set-off', value: y });
                    }, state.duration);
                    store.dispatch({ type: 'set-playing', value: y });
                })();
            }
        });
    }

    function renderSequencer() {
        stepSequencer.removeAllListeners();
        var state = store.getState();
        stepSequencer.setTempo(state.tempo * options.stepsPerBeat);
        stepSequencer.setSequence(state.numberOfSteps, []);
        registerSequence(state.numberOfSteps);
    }

    function registerSequence(numberOfSteps) {
        var _loop = function _loop(step) {
            stepSequencer.on(step, function () {
                store.dispatch({ type: 'set-step', value: step });
                renderMidi();
                renderLeds();
            });
        };

        for (var step = 0; step < numberOfSteps; step++) {
            _loop(step);
        }
    }
    registerSequence(options.numberOfSteps);

    launchpad.on('press', function (button) {
        if (!button.special) {
            var state = store.getState();

            var _state$getOffsets3 = state.getOffsets();

            var _state$getOffsets4 = _slicedToArray(_state$getOffsets3, 2);

            var offsetX = _state$getOffsets4[0];
            var offsetY = _state$getOffsets4[1];

            var x = button.x + offsetX;
            var y = button.y + offsetY;
            store.dispatch({ type: 'toggle-button', value: [x, y] });
        } else {
            switch (button.special[0]) {
                case 'mixer':
                    store.dispatch({ type: 'change-velocity-brush' });
                    break;
                case 'session':
                    store.dispatch({ type: 'clear-grid' });
                    break;
                case 'down':
                    store.dispatch({ type: 'page-down' });
                    break;
                case 'up':
                    store.dispatch({ type: 'page-up' });
                    break;
                case 'left':
                    store.dispatch({ type: 'decrement-steps', value: 1 });
                    renderSequencer();
                    break;
                case 'right':
                    store.dispatch({ type: 'increment-steps', value: 1 });
                    renderSequencer();
                    break;
            }
        }
        renderLeds();
    });

    stepSequencer.play();
});
#!/usr/bin/env node

'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

require("babel-polyfill");
var midi = require('midi');
var midiLaunchpad = require('midi-launchpad');
var tonalRange = require('tonal-range');

var _require = require('midi-help'),
    noteOn = _require.noteOn,
    noteOff = _require.noteOff;

var _midiLaunchpad$colors = midiLaunchpad.colors,
    red = _midiLaunchpad$colors.red,
    green = _midiLaunchpad$colors.green,
    yellow = _midiLaunchpad$colors.yellow,
    orange = _midiLaunchpad$colors.orange,
    off = _midiLaunchpad$colors.off;


var util = require('./util');
var scales = require('./scales');

var options = require('./options');
var store = require('./state')(options);
store.dispatch({ type: 'reset' });

var midiOutput = new midi.output('launch-step', true);
midiOutput.openVirtualPort('launch-step output');

//undefined = auto-connect, false = disable animation
var connection = midiLaunchpad.connect(undefined, false);

connection.on('ready', function (launchpad) {
    process.on('SIGINT', function () {
        var state = store.getState();
        //turn off any playing notes
        state.playing.forEach(function (playing, y) {
            if (playing) {
                var note = state.noteRows[y];
                midiOutput.sendMessage(noteOff(note, 0, options.channel - 1));
                store.dispatch({ type: 'set-off', y: y });
            }
        });
        launchpad.clear();
        process.exit();
    });

    function renderLeds() {
        var state = store.getState();
        var canvas = util.emptyGrid(8, 8, off);

        var _state$getOffsets = state.getOffsets(),
            _state$getOffsets2 = _slicedToArray(_state$getOffsets, 2),
            offsetX = _state$getOffsets2[0],
            offsetY = _state$getOffsets2[1];

        var step = state.step - offsetX;
        var page = state.stepGrid.slice(offsetX, offsetX + 8).map(function (column) {
            return column.slice(offsetY, offsetY + 8);
        });
        var endIndex = state.numberOfSteps - offsetX;
        //draw all the squares
        canvas.forEach(function (row, y) {
            page.forEach(function (values, x) {
                var velocity = values[y];
                var level = void 0;
                if (velocity === 127) {
                    level = 'high';
                } else if (velocity >= 100) {
                    level = 'medium';
                } else {
                    level = 'low';
                }
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
            var c = [green.high, yellow.high, orange.high, red.high, red.high][Math.abs(level) - 1];
            if (Math.abs(level) > 4) {
                topRow[0] = c;
                topRow[1] = c;
            } else if (level < 0) {
                topRow[0] = c;
            } else {
                topRow[1] = c;
            }
        }
        //user1 is green
        topRow[5] = green.high;
        //session button red
        topRow[4] = red.high;
        canvas.push(topRow);
        launchpad.renderColors(canvas);
    }

    function renderMidi() {
        var state = store.getState();
        state.stepGrid[state.step].forEach(function (velocity, y) {
            if (velocity) {
                var note = state.noteRows[y];
                midiOutput.sendMessage(noteOn(note, velocity, options.channel - 1));
                setTimeout(function () {
                    midiOutput.sendMessage(noteOff(note, velocity, options.channel - 1));
                    store.dispatch({ type: 'set-off', value: y });
                }, state.duration);
                store.dispatch({ type: 'set-playing', value: y });
            }
        });
    }

    launchpad.on('press', function (button) {
        if (!button.special) {
            var state = store.getState();

            var _state$getOffsets3 = state.getOffsets(),
                _state$getOffsets4 = _slicedToArray(_state$getOffsets3, 2),
                offsetX = _state$getOffsets4[0],
                offsetY = _state$getOffsets4[1];

            var x = button.x + offsetX;
            var y = button.y + offsetY;
            var velocity = state.stepGrid[x][y];
            if (velocity === 0) {
                store.dispatch({ type: 'set-velocity', value: [x, y, 127] });
                var initialTime = 1;
                var t = setInterval(function (a) {
                    if (initialTime > 0) {
                        initialTime -= 1;
                    } else {
                        var _state = store.getState();
                        var _velocity = _state.stepGrid[x][y];
                        if (_velocity > 17) {
                            store.dispatch({ type: 'set-velocity', value: [x, y, _velocity - 10] });
                        }
                    }
                }, 200);
                store.dispatch({ type: 'set-button-timer', value: [x, y, t] });
            } else {
                store.dispatch({ type: 'set-velocity', value: [x, y, 0] });
            }
        } else {
            switch (button.special[0]) {
                case 'user 1':
                    store.dispatch({ type: 'set-step', value: 0 });
                    if (options.tempo !== 'ext') {
                        setTimer();
                    }
                    break;
                case 'session':
                    store.dispatch({ type: 'reset' });
                    if (options.tempo !== 'ext') {
                        setTimer();
                    }
                    break;
                case 'down':
                    store.dispatch({ type: 'page-down' });
                    break;
                case 'up':
                    store.dispatch({ type: 'page-up' });
                    break;
                case 'left':
                    store.dispatch({ type: 'decrement-steps', value: 1 });
                    break;
                case 'right':
                    store.dispatch({ type: 'increment-steps', value: 1 });
                    break;
            }
        }
        renderLeds();
    });

    launchpad.on('release', function (button) {
        if (!button.special) {
            var state = store.getState();

            var _state$getOffsets5 = state.getOffsets(),
                _state$getOffsets6 = _slicedToArray(_state$getOffsets5, 2),
                offsetX = _state$getOffsets6[0],
                offsetY = _state$getOffsets6[1];

            var x = button.x + offsetX;
            var y = button.y + offsetY;
            store.dispatch({ type: 'set-button-timer', value: [x, y, null] });
        }
    });

    var count = 0;
    function beat() {
        count += 1;
        //beat clock is 24 per quarter i.e. per beat
        if (count >= 24 / options.stepsPerBeat) {
            count = 0;
            var state = store.getState();
            var step = state.step + 1;
            if (step >= state.numberOfSteps) {
                step -= state.numberOfSteps;
            }
            store.dispatch({ type: 'set-step', value: step });
            renderMidi();
            renderLeds();
        }
    }

    var timer = void 0;
    function setTimer() {
        clearInterval(timer);
        if (options.tempo !== 'ext') {
            timer = setInterval(beat, 1000 / (options.tempo / 60) / 24);
        }
    }

    if (options.tempo !== 'ext') {
        setTimer();
    } else {
        var midiInput = new midi.input();
        //don't ignore midi clock messages
        midiInput.ignoreTypes(true, false, true);
        midiInput.openVirtualPort('launch-step clock input');
        midiInput.on('message', beat);
    }
});
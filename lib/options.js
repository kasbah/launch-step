'use strict';

var argv = require('argv-me');
var tonalMidi = require('tonal-midi');

var scales = require('./scales');

var args = argv.option([{
    name: 'channel',
    short: 'c',
    type: 'int',
    description: 'MIDI channel number, the default is 1.',
    example: "'launch-step -c 2' or 'launch-step --channel=2'"
}, {
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
    channel: args.options.channel || 1,
    root: tonalMidi.toMidi(args.options['root-note'] || 60)
};

if (isNaN(options.root) || options.root == null) {
    console.error('Invalid root note \'' + args.options['root-note'] + '\' given. Should be a MIDI note number like 64 or a note name like A3, C#3 or Eb2.');
    process.exit(1);
}
if (typeof options.channel !== 'number' || options.channel < 1 || options.channel > 16) {
    console.error('Invalid MIDI channel \'' + args.options.channel + '\' given. Should be a number between 1 and 16.');
    process.exit(1);
}
if (!(scales.supportedScales.indexOf(options.scale) !== -1)) {
    console.error('No scale named \'' + options.scale + '\', run \'launch-step --help\'for a list of available scales.');
    process.exit(1);
}
console.log('Starting ' + options.numberOfSteps + ' step sequencer on channel ' + options.channel + ' at ' + options.tempo + ' bpm, ' + options.stepsPerBeat + ' steps per beat, using ' + options.scale + ' scale starting with MIDI note ' + options.root + ' (' + tonalMidi.fromMidi(options.root) + ').');

module.exports = options;
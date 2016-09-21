const midi = require('midi')
const input = new midi.input()
const output = new midi.output()
const midiLaunchpad = require('midi-launchpad')
const {red, green, orange, yellow, off} = midiLaunchpad.colors

const connection = midiLaunchpad.connect()

connection.on('ready', launchpad => {
  launchpad.on('press', button => {
    if(button.getState() !== off) {
      button.light(off)
    } else {
      button.light(green.high)
    }
  })
})

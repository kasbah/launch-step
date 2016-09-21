const midi = require('midi')
const input = new midi.input()
const output = new midi.output()
const midiLaunchpad = require('midi-launchpad')
const {red, green, orange, yellow} = midiLaunchpad.colors

const connection = midiLaunchpad.connect()

connection.on('ready', launchpad => {
  launchpad.on('press', button => {
    console.log(button.x, button.y)
    button.light(green.high)
  })
})

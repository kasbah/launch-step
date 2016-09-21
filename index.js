const midi = require('midi')
const input = new midi.input()
const output = new midi.output()
const midiLaunchpad = require('midi-launchpad')
const {red, green, orange, yellow, connect} = midiLaunchpad.colors

let port = 0
for (let i = 0; i < input.getPortCount(); i++)  {
    if (/Launchpad/.test(input.getPortName(i))) {
        port = i
    }
}

const connection = midiLaunchpad.connect(port)


connection.on('ready', launchpad => {
  launchpad.on('press', button => {
    console.log(button.x, button.y)
    button.light(green.high)
  })
})

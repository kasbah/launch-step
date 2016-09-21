const midi = require('midi')
const input = new midi.input()
const output = new midi.output()
const {red, green, orange, yellow} = require('midi-launchpad').colors
let port = 0

for (let i = 0; i < input.getPortCount(); i++)  {
    if (/Launchpad/.test(input.getPortName(i))) {
        port = i
    }
}

var midiConnector = require('midi-launchpad').connect(port, false);

// wait for the connector to be ready
midiConnector.on('ready',function(launchpad) {
  launchpad.on('press', (button) => {
    console.log(button.x, button.y)
    button.light(green.high)
  })
})


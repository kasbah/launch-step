const StepSequencer = require('step-sequencer')

const sequencer = new StepSequencer()

sequencer.on(0, (step) => console.log(0, step))

sequencer.play()

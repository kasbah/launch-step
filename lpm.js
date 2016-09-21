'use strict';
const Launchpad = require( 'launchpad-mini' ),
      pad = new Launchpad();

pad.connect().then( () => {     // Auto-detect Launchpad
    pad.reset( 2 );             // Make Launchpad glow yellow
    pad.on( 'key', k => {
        pad.col( pad.red, k );  // Turn on buttons on press
    } );
} );

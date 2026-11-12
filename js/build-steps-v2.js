// Build guide content for V2, prototype 2 (cad/printed-frame.scad, 2026-11-11/12): the printed frame.
// Same shape as build-steps.js. `model` names are nodes in build/plotter-v2.glb
// (tools/make-build-model.py v2); parts shared with V1 keep V1's names and pieces.
import { PARTS as V1 } from './build-steps.js';

const amazon = asin => `https://www.amazon.com/dp/${asin}`;
const amazonSearch = q => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
const stl = name => `build/stl/${name}.stl`;
const SOURCE = 'https://github.com/TimothyHadfield/polar-cnc-plotter/blob/main/cad/printed-frame.scad';

// every part once; steps refer to them by key
export const PARTS = {
  fittest:   { name: 'Fit test (printed, 15 min)', qty: 1, buy: ['STL', stl('frame_fit_test')] },
  base:      { name: 'Base (printed)', qty: 1, model: ['frame_base'], buy: ['STL', stl('frame_base')],
               about: 'One print instead of the board and feet. Rails at both ends, motor cage in the middle, Uno pocket at the back.' },
  standR:    { name: 'Right stand (printed)', qty: 1, model: ['stand_right'], buy: ['STL', stl('frame_stand_right')],
               about: 'Holds the rod ends and the X motor. Slides onto the base rail from the front until it stops.' },
  standL:    { name: 'Left stand (printed)', qty: 1, model: ['stand_left'], buy: ['STL', stl('frame_stand_left')],
               about: 'Holds the other rod ends and the idler fork. The bolt sits in a slot that tensions the belt.' },
  rods:      V1.rods,
  blocks:    V1.blocks,
  carriage:  V1.carriage,
  stage:     V1.stage,
  clip:      V1.clip,
  knob:      V1.knob,
  pen:       V1.pen,
  nema:      { ...V1.nema, about: 'Moves in exact 1.8° steps. One pulls the carriage (radius), one turns the platter directly (angle).' },
  pulley16:  V1.pulley16,
  idler:     { name: 'GT2 20T bearing idler, 3 mm bore', qty: 1, model: ['idler'], buy: ['Amazon', amazon('B08J9W4PJT')],
               about: 'Turns the belt round at the far end. Ball bearings inside: quiet and low friction.' },
  spacers:   { name: 'Idler spacer (printed)', qty: 2, model: ['idler_spacers'], buy: ['STL', stl('frame_idler_spacers')],
               about: 'One each side of the idler. They press only its inner ring, so the bolt can be tight while it spins.' },
  idlerBolt: { name: 'M3 × 25 bolt + nut', qty: 1, model: ['idler_bolt'],
               about: 'The idler\'s axle. The nut sits in a slot pocket, so it slides with the bolt but can\'t turn.' },
  belt:      V1.belt,
  ties:      V1.ties,
  wheel:     { name: 'Platter wheel (printed)', qty: 1, model: ['wheel'], buy: ['STL', stl('frame_wheel')],
               about: 'Six spokes and a rim. Its solid top is the drawing face, printed on the bed so it comes out flat.' },
  collar:    { name: 'Shaft collar (printed) + 2 M3 × 8 screws + 2 nuts', qty: 1, model: ['collar'], buy: ['STL', stl('frame_collar')],
               about: 'Clamps the motor shaft. The wheel presses onto its hex taper: it turns the wheel with no play, and lifts off.' },
  pad:       { name: 'Soft pad ~1 mm (vinyl or rubber)', qty: 1, model: ['pad'], buy: ['Amazon', amazonSearch('1mm rubber sheet')],
               about: 'Under the paper, so the pen can press slightly past the surface.' },
  paper:     { name: 'Paper circle 196 mm', qty: 1, model: ['paper'],
               about: 'The drawing. The clamp ring holds its edge, so draw inside about 180 mm.' },
  ring:      { name: 'Clamp ring (printed)', qty: 1, model: ['clamp_ring'], buy: ['STL', stl('frame_clamp_ring')],
               about: 'Snaps over the rim and pins pad and paper down. Its hooks sit between key ribs, so it can\'t turn.' },
  uno:       V1.uno,
  shield:    V1.shield,
  drivers:   V1.drivers,
  wires:     V1.wires,
  jack:      { ...V1.jack, model: undefined },
  supply:    V1.supply,
  cable:     V1.cable,
  wrap:      V1.wrap,
  screws:    { name: 'M3 screws: 6 × 8, 4 × 6, 1 × 25, 3 nuts', qty: 1, buy: V1.screws.buy },
};

export const STEPS = [
  {
    title: 'Overview', show: 'all',
    do: [
      'A pen slides along the rail (radius) while the platter turns (angle).',
      'V2: printed frame, no wood, PVC or glue. The motor turns the platter directly.',
      'Tools: 3D printer, hex keys, small screwdriver, multimeter.',
    ],
    parts: Object.keys(PARTS),
    links: [['Printed frame source (OpenSCAD)', SOURCE],
            ['Printed parts source (OpenSCAD)', 'https://github.com/TimothyHadfield/polar-cnc-plotter/tree/main/cad']],
  },
  {
    title: 'Prints', show: ['frame_base', 'stand_right', 'stand_left', 'wheel', 'collar', 'clamp_ring', 'idler_spacers'],
    do: [
      'Fit test first: the groove slides on the rail, a rod goes in snug.',
      'Base flat. Supports from the bed only, under the motor cage roof.',
      'Stands on their outer face, wheel and clamp ring top face down.',
      'Everything else needs no supports.',
    ],
    parts: ['fittest', 'base', 'standR', 'standL', 'wheel', 'collar', 'ring', 'spacers'],
  },
  {
    title: 'Stands', show: ['stand_right', 'stand_left', 'x_motor', 'x_pulley', 'idler', 'idler_spacers', 'idler_bolt'],
    view: [-20, 15],
    do: [
      'Bolt a NEMA 17 to the right stand\'s front face, 4 × M3 × 8 from behind.',
      'Pulley on its shaft, in line with the rods.',
      'Left fork: spacer, idler, spacer on the M3 × 25 bolt, nut in its pocket.',
      'Leave the bolt loose for now: its slot tensions the belt.',
    ],
    parts: ['standR', 'standL', 'nema', 'pulley16', 'idler', 'spacers', 'idlerBolt', 'screws'],
  },
  {
    title: 'Rail and base', show: ['frame_base', 'stand_right', 'stand_left', 'rods', 'blocks', 'x_motor', 'x_pulley', 'idler', 'idler_spacers', 'idler_bolt'],
    do: [
      'Slide two bearing blocks onto each rod.',
      'Push the rods into both stands, one above the other.',
      'Slide stands and rods onto the base rails from the front, together, until they stop.',
    ],
    parts: ['rods', 'blocks', 'base'],
  },
  {
    title: 'Carriage belt', show: ['carriage_plate', 'blocks', 'rods', 'x_belt', 'x_pulley', 'x_motor', 'idler', 'idler_spacers', 'idler_bolt'],
    view: [-20, 15],
    do: [
      'Bolt the carriage plate to the four blocks.',
      'Belt over both pulleys, ends round the carriage pegs, zip-tied.',
      'Pull the idler outward in its slot until the belt is tight, then tighten the bolt.',
      'The carriage should slide end to end without catching.',
    ],
    parts: ['carriage', 'belt', 'ties', 'screws'],
  },
  {
    title: 'Pen lift', show: ['stage', 'slider', 'pen_clip', 'knob', 'pen'],
    do: [
      'Screw the linear stage to the front of the carriage plate, motor on top.',
      'Fix the pen clip to the stage slider.',
      'Pen in the clip, knob tightens it. Tip just touches paper at the bottom.',
    ],
    parts: ['stage', 'clip', 'knob', 'pen'],
  },
  {
    title: 'Electronics', show: ['frame_base', 'electronics', 'wires'],
    do: [
      'Shield on the Uno. Jumpers MS1 + MS2 under X, Y and Z (1/16 steps).',
      'Drivers: EN pin to the shield\'s EN mark. Backwards burns them.',
      'Slide the Uno into its pocket from the back until it stops.',
      'Carriage motor to X, platter to Y, pen stage to Z. Coil pairs on pins 1-2 and 3-4.',
      'Driver knob voltage: X and Y about 1.3 V, Z about 0.4 V. Set it now: the wheel covers the board.',
      'Never plug or unplug a motor with power on.',
    ],
    parts: ['uno', 'shield', 'drivers', 'wires', 'jack', 'supply', 'cable', 'wrap'],
    links: [['TMC2209 pinout', 'https://learn.watterott.com/silentstepstick/pinconfig/tmc2209/']],
  },
  {
    title: 'Platter motor', show: ['frame_base', 'y_motor'], view: [-10, 30],
    do: [
      'Slide the motor into its cage from the front, shaft up, plug to the back.',
      'Push it back against the stop ribs: the shaft is now under the pen line.',
      'Fix it with 4 × M3 × 6 from the top.',
    ],
    parts: ['nema', 'base', 'screws'],
  },
  {
    title: 'Platter', show: ['y_motor', 'collar', 'wheel', 'pad', 'paper', 'clamp_ring'], view: [20, 30],
    do: [
      'Collar onto the shaft first, top flush with the shaft tip.',
      'Nuts into its slot, then tighten its 2 M3 × 8 screws onto the shaft\'s flat.',
      'Press the wheel down onto the collar\'s hex taper, screw heads in its channel. Pull up to take it off.',
      'Pad, then paper, then snap the clamp ring over the rim, hooks between the key ribs.',
    ],
    parts: ['collar', 'wheel', 'pad', 'paper', 'ring'],
  },
  {
    title: 'Firmware', show: ['electronics'],
    do: [
      'Install the Arduino IDE (and the CH340 driver for clone boards).',
      'Flash GRBL 1.1 to the Uno.',
      'In the plotter app, connect and run Calibrate.',
      'Starting values: $100=100 (carriage), $101=8.889 (platter, degrees, direct drive).',
    ],
    parts: ['uno', 'cable'],
    links: [['Arduino IDE', 'https://www.arduino.cc/en/software'], ['GRBL', 'https://github.com/gnea/grbl'],
            ['Flashing GRBL', 'https://github.com/gnea/grbl/wiki/Flashing-Grbl-to-an-Arduino'],
            ['CH340 driver', 'https://learn.sparkfun.com/tutorials/how-to-install-ch340-drivers/all'],
            ['GRBL settings', 'https://github.com/gnea/grbl/wiki/Grbl-v1.1-Configuration']],
  },
  {
    title: 'Plot', show: 'all',
    do: [
      'Open the plotter app in Chrome or Edge on a computer.',
      'Load a picture, connect, put the pen on the platter centre, Set center, Plot.',
    ],
    parts: [],
    links: [['Open the plotter app', './'], ['Try it in the simulator', 'sim.html?v=2']],
  },
];

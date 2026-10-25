// Build guide content: the steps, what each shows in 3D, and where to get every part.
// `model` names are nodes in build/plotter.glb (cad/plotter-assembly.scad `show(...)` names).

const amazon = asin => `https://www.amazon.com/dp/${asin}`;
const amazonSearch = q => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
const homeDepot = q => `https://www.homedepot.com/s/${encodeURIComponent(q)}`;
const stl = name => `build/stl/${name}.stl`;
const GUIDE = 'https://www.instructables.com/Polar-CNC-Plotter-V2/';

// every part once; steps refer to them by key
export const PARTS = {
  board:     { name: 'Plywood base 40 × 13 cm, 5 mm', qty: 1, model: ['board'], buy: ['Home Depot', homeDepot('plywood project panel')] },
  bars:      { name: 'Square steel tube 15 × 15 mm', qty: 2, model: ['bars'], buy: ['Home Depot', homeDepot('steel square tube 1/2 in')] },
  holders:   { name: 'PVC screw holder (printed)', qty: 2, model: ['screw_holders'], buy: ['STL (guide)', GUIDE] },
  pvc:       { name: '1/2" PVC: 2 tees, 2 elbows, 2 couplings, pipe', qty: 1, model: ['stands'], buy: ['Home Depot', homeDepot('1/2 in pvc fitting')] },
  spools:    { name: 'Rod support (printed)', qty: 4, model: ['spools'], buy: ['STL', stl('spool')] },
  rods:      { name: 'Rod 8 × 300 mm', qty: 2, model: ['rods'], buy: ['Amazon', amazon('B0BNLDZ6Y5')] },
  blocks:    { name: 'SC8UU bearing block', qty: 4, model: ['blocks'], buy: ['Amazon', amazon('B0DCVVTC5F')] },
  carriage:  { name: 'Carriage plate (printed)', qty: 1, model: ['carriage_plate'], buy: ['STL', stl('carriage_plate')] },
  stage:     { name: 'Linear stage 48 mm, 5 V stepper', qty: 1, model: ['stage', 'slider'], buy: ['Amazon', amazon('B09BZFKJGF')] },
  clip:      { name: 'Pen clip (printed)', qty: 1, model: ['pen_clip'], buy: ['STL', stl('clip')] },
  knob:      { name: 'Clip knob (printed) + M4 screw', qty: 1, model: ['knob'], buy: ['STL', stl('gear')] },
  pen:       { name: 'Marker pen', qty: 1, model: ['pen'] },
  nema:      { name: 'NEMA 17 stepper 1.5 A (3-pack)', qty: 2, model: ['x_motor', 'y_motor'], buy: ['Amazon', amazon('B0B38GHRH8')] },
  xplate:    { name: 'X motor plate (printed)', qty: 1, model: ['x_motor_plate'], buy: ['STL', stl('motor_plate_2')] },
  pulley16:  { name: 'GT2 pulley 16T, 5 mm bore', qty: 1, model: ['x_pulley'], buy: ['Amazon', amazon('B077GMR328')] },
  bracket:   { name: 'Idler bracket (printed)', qty: 1, model: ['idler_bracket'], buy: ['STL', stl('bracket')] },
  idler:     { name: 'Idler pulley 20T (printed) + 3 mm axle', qty: 1, model: ['idler_pulley'], buy: ['STL', stl('pulley_a')] },
  belt:      { name: 'GT2 belt 6 mm (5 m roll)', qty: 1, model: ['x_belt'], buy: ['Amazon', amazon('B0BSMNZ53S')] },
  ties:      { name: 'Zip ties', qty: 2 },
  disc:      { name: 'Aluminium disc 200 mm × 1 mm', qty: 1, model: ['platter'], buy: ['Amazon', amazon('B0FMF8FJ3X')] },
  strip:     { name: 'Steel strip ~100 × 12 mm', qty: 1, model: ['steel_strip'] },
  cd:        { name: 'Old CD', qty: 1, model: ['cd'] },
  paper:     { name: 'Paper circle', qty: 1, model: ['paper'] },
  rplate:    { name: 'Rotary plate (printed)', qty: 1, model: ['rotary_plate'], buy: ['STL', stl('motor_plate')] },
  spacers:   { name: 'Plate spacer 26 mm (printed)', qty: 4, model: ['spacers'], buy: ['STL (guide)', GUIDE] },
  spindle:   { name: 'Disc-drive spindle motor (salvaged)', qty: 1, model: ['spindle'] },
  pulley20:  { name: 'Drive pulley 20T (printed)', qty: 1, model: ['y_pulley'], buy: ['STL', stl('pulley_b')] },
  pulley60:  { name: 'Platter pulley 60T (printed)', qty: 1, model: ['big_pulley'], buy: ['STL', stl('big_pulley')] },
  loop:      { name: 'GT2 closed belt 220 mm', qty: 1, model: ['y_belt'], buy: ['Amazon', amazon('B0CMSVNMGN')] },
  uno:       { name: 'Arduino Uno R3', qty: 1, model: ['electronics'], buy: ['Amazon', amazon('B008GRTSV6')] },
  shield:    { name: 'CNC Shield V3', qty: 1, model: ['electronics'], buy: ['Amazon', amazon('B07PDFYVTS')] },
  drivers:   { name: 'TMC2209 drivers (5-pack)', qty: 3, model: ['electronics'], buy: ['Amazon', amazonSearch('Teyleten Robot TMC2209 V2.0 5pcs')] },
  jack:      { name: 'DC jack 5.5 × 2.1 mm', qty: 1, model: ['power_jack'], buy: ['Amazon', amazon('B0D9B7WR23')] },
  supply:    { name: '12 V power supply, 2 A or more', qty: 1, buy: ['Amazon', amazonSearch('12V 5A power supply 5.5x2.1mm')] },
  cable:     { name: 'USB cable for the Uno', qty: 1, buy: ['Amazon', amazon('B09F9HSZ3W')] },
  wrap:      { name: 'Spiral cable wrap 6 mm', qty: 1, buy: ['Amazon', amazonSearch('XHF 1/4 inch spiral cable wrap 50ft')] },
  screws:    { name: 'M3 screws + nuts, small wood screws', qty: 1, buy: ['Home Depot', homeDepot('m3 screw nut assortment')] },
  glue:      { name: 'Super glue', qty: 1, buy: ['Home Depot', homeDepot('super glue')] },
};

export const STEPS = [
  {
    title: 'Overview', show: 'all',
    do: [
      'A pen slides along the rail (radius) while the platter turns (angle).',
      'Tools: drill, saw, pipe cutter, 3D printer, multimeter.',
      'Based on Polar CNC Plotter V2, with fixes from building it.',
    ],
    parts: Object.keys(PARTS),
    links: [['Original guide', GUIDE], ['Build video', 'https://www.youtube.com/watch?v=GmB76t6MUKI'],
            ['Printed parts source (OpenSCAD)', 'https://github.com/TimothyHadfield/polar-cnc-plotter/tree/main/cad']],
  },
  {
    title: 'Base', show: ['board', 'bars', 'screw_holders'],
    do: [
      'Cut the board 40 × 13 cm.',
      'Screw the two steel tubes underneath, the long way, as feet.',
      'Screw a PVC holder at each end, 300 mm apart, near the back edge.',
      'Cut a 46 mm square hole for the platter motor (see the Platter drive step).',
    ],
    parts: ['board', 'bars', 'holders', 'screws'],
  },
  {
    title: 'Stands', show: ['stands', 'spools'],
    do: [
      'Each stand, bottom to top: coupling, pipe, tee, 30 mm pipe, elbow.',
      'Tee and elbow openings face inward, straight in line.',
      'Glue a rod support into each opening (no tape needed).',
      'Push the stands onto the base holders.',
    ],
    parts: ['pvc', 'spools', 'glue'],
  },
  {
    title: 'Rail and carriage', show: ['rods', 'blocks', 'carriage_plate'],
    do: [
      'Slide two bearing blocks onto each rod.',
      'Bolt the four blocks to the back of the carriage plate.',
      'Push the rods into the rod supports, one above the other.',
      'The carriage should slide end to end without catching.',
    ],
    parts: ['rods', 'blocks', 'carriage', 'screws'],
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
    title: 'Carriage belt', show: ['x_motor_plate', 'x_motor', 'x_pulley', 'idler_bracket', 'idler_pulley', 'x_belt'],
    view: [200, 15],
    do: [
      'Bolt a NEMA 17 to the X motor plate; the round recess takes its collar.',
      'Screw the plate to the right stand, motor behind, pulley between the rods.',
      'Idler pulley in its bracket on the left stand, same height.',
      'Belt around both pulleys, ends on the carriage pegs, pulled tight with zip ties.',
    ],
    parts: ['nema', 'xplate', 'pulley16', 'bracket', 'idler', 'belt', 'ties', 'screws'],
  },
  {
    title: 'Platter', show: ['platter', 'steel_strip', 'cd', 'paper'], view: [20, -35],
    do: [
      'Glue the steel strip across the centre of the disc, underneath.',
      'Glue the CD over it, exactly centred: its hole centres the platter.',
      'The spindle magnet holds the strip, so the platter lifts off.',
    ],
    parts: ['disc', 'strip', 'cd', 'paper', 'glue'],
  },
  {
    title: 'Platter drive', show: ['rotary_plate', 'spacers', 'y_motor', 'y_pulley', 'spindle', 'big_pulley', 'y_belt'],
    do: [
      'Spindle on top of the rotary plate, NEMA 17 underneath, 68 mm apart.',
      'Small pulley on the motor, big pulley glued on the spindle, closed belt around both.',
      'Plate on four spacers; motor through the hole in the base.',
      'The pen line must pass over the spindle centre. Any miss: app setting "Center gap".',
    ],
    parts: ['rplate', 'spacers', 'spindle', 'nema', 'pulley20', 'pulley60', 'loop', 'screws'],
  },
  {
    title: 'Electronics', show: ['electronics', 'power_jack'],
    do: [
      'Shield on the Uno. Jumpers MS1 + MS2 under X, Y and Z (1/16 steps).',
      'Drivers: EN pin to the shield\'s EN mark. Backwards burns them.',
      'Find each motor\'s coil pairs with a meter (~2 Ω). One pair per side of the plug.',
      'Carriage motor to X, platter to Y, pen stage to Z. 12 V to the screw terminal.',
      'Driver knob voltage: X and Y about 1.0 V, Z about 0.3 V.',
      'Never plug or unplug a motor with power on.',
    ],
    parts: ['uno', 'shield', 'drivers', 'jack', 'supply', 'cable', 'wrap'],
    links: [['TMC2209 pinout', 'https://learn.watterott.com/silentstepstick/pinconfig/tmc2209/']],
  },
  {
    title: 'Firmware', show: ['electronics'],
    do: [
      'Install the Arduino IDE (and the CH340 driver for clone boards).',
      'Flash GRBL 1.1 to the Uno.',
      'In the plotter app, connect and run Calibrate.',
      'Starting values: $100=100 (carriage), $101=26.667 (platter, degrees).',
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
    links: [['Open the plotter app', './']],
  },
];

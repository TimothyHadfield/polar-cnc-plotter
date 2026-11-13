// Printed frame, prototype 2 (2026-11-11). Replaces the plywood board, PVC stands, rod spools,
// screw holders, motor_plate_2, idler bracket + nail, motor_stand, the glued platter hub and the
// paper ring.
// Tim: "scrap the wooden board at the bottom entirely, as well as maybe the PVC pipes so that
// everything is lined up perfectly ... print them in 3 separate components (each stand and the
// bottom plate), and then connect them together".
// Prototype 2 (Tim's review): no bolts between stands and base ("move away from screws/bolts";
// nothing may poke out under the base) -> sliding dovetails; Arduino held without screws; the
// platter motor must actually go into its cage -> cage top slotted open to the front; the disc
// is held by a snap-on clamp ring instead of edge fingers ("I don't see how they're useful").
//
// Assembly order (pre-print check 11-11): X motor onto the right stand (4 x M3x8 from behind) and
// the idler onto the left fork (M3x25 + nut) -> 4 bearing blocks onto the 2 rods -> rods into both
// stands -> slide stands + rods onto the base's rails from the BACK, pushing forward, together,
// until they stop (each groove is closed at its back end, which meets the rail's back end)
// -> carriage plate onto the blocks, belt on its pegs -> Uno slides into its pocket from the back
// (set driver currents now; the wheel covers the board) -> platter motor slides into its cage
// from the front, 4 screws from the top started loose (M3x6, or M3x8 with a printed washer under
// each head) -> carriage over the motor, motor slid front to back until its shaft is under the pen
// tip, screws tightened (base 2, 11-13: the motor is adjustable, see cage_y) ->
// setting gauge on the cage top, shaft collar pushed down onto it, 2 M3x8 pan-head screws on the
// flat, gauge out -> wheel pressed down onto the collar's hex taper (the screw heads slide up its
// channel) ->
// pad, paper, clamp ring snapped over (hooks between the key ribs).
//
// Prints: (fit_test is optional, ~50 min on Tim's Bambu; Tim skipped it 11-12.) frame_base (flat; supports are needed in ONE place, under
// the motor cage's roof. They stand on the base itself, so Bambu's "On build plate only" must be
// UNTICKED or none are made: checked with a headless Bambu Studio slice 11-12), stand_right + stand_left (each lies on its outer face, so every wall grows
// straight up and the rod holes print vertical and round), wheel (platter face down), clamp_ring
// (top face down), collar (upright), collar_gauge + motor_washers (flat). The stands, wheel and
// ring need no supports (the stand groove's upper side is relieved for that, see dt_groove).
// World: X along the rods, Y toward the back, Z up. Base top z = 0, platter centre at x = 0.
// One part: openscad -D 'part="stand_right"' ...

use <plotter-parts.scad>
use <plotter-assembly.scad>

part = "assembly";
show_disc = true;      // false: the assembly without disc, paper and clamp ring
$fn = 64;

// ---------- numbers to measure (assumed until Tim measures) ----------
rod_len   = 300;      // the 8 mm rods. Rod holes end 2 mm past +-rod_len/2 (rods may float 4 mm)
shaft_len = 23.5;     // platter motor shaft above its face. STEPPERONLINE 17HE15-1504S product page:
                      // 23.5 long, D flat 20 long (the flat starts 3.5 above the face). Not used for
                      // any size any more: the collar's height is set by collar_gauge.
disc_d    = 200;      // aluminium platter disc
disc_t    = 1;
// Pen line (Tim 11-11: "make sure it's all aligned perfectly"). Front-to-back chain from the rods:
//   rod centre -> SC8UU mounting face (sc8uu_h) -> carriage plate back face -> pen centre (carriage_d).
// First print (Tim 11-13): "the central plate motor is about an inch forward of the pen". Cause:
// carriage_d was 50.0, a chain of unmeasured depths that stacked a 14 mm slider on a 20 mm stage.
// His real stage: "The center brick ... only sticks out about 1 cm further than the rest of the
// motor", and the listing's 20 is the depth of the whole thing, slider included.
// carriage_d now: plate 2 + 1 (stage face pad) - 1.5 (stage pocket) = 1.5, stage body 10, slider
// 10, clip 23 with the pen 8.5 in (the V1 clip; the holder for this slider is NOT final) -> 36.0.
// Still not measured, and Tim's "about an inch" would be 25, not 14. So the base no longer trusts
// this number: the platter motor slides front to back in its cage (cage_y, motor_adj below) and is
// set under the real pen tip. pen_y is only where the model draws the pen, the wheel and the motor.
rod_y      = 50;      // rods' plane (stands and frame are built around it)
sc8uu_h    = 11;     // SC8UU spec: rod centre to mounting face. Measure: block depth / 2 (22 / 2)
carriage_d = 36.0;    // carriage plate back face (bearing side) to the pen's centre line. MEASURE
pen_y      = rod_y - sc8uu_h - carriage_d;   // = 3.0 (the first print had -11.0)

// ---------- platter stack ----------
motor_len = 38;  stand_gap = 0.5;
cage_top  = 6;
face_z    = motor_len + stand_gap;     // 38.5: motor face, under the cage top
cage_z    = face_z + cage_top;         // 44.5
// Design review 11-12: the wheel seats on a taper, and where it seats moves ~1.2 mm per 0.1 mm of
// print error on the hex (see the collar). 2 mm over the cage (was 1) so it can never rub; the
// height no longer hangs on the shaft's length.
wheel_gap = 2;
w_h       = 18;                        // wheel height under its top skin
wheel_z0  = cage_z + wheel_gap;        // 46.5
wheel_top = wheel_z0 + w_h;            // 64.5: the disc rests here
plate_top = wheel_top + disc_t;        // 65.5
lift      = plate_top - 41;            // everything on the rods rises this much
rod_lo = 75 + lift;
rod_hi = 137 + lift;
belt_z = (rod_lo + rod_hi) / 2;

// ---------- base ----------
base_t  = 6;
base_x  = 125;                 // base spans x -125..125 (fits a 256 mm bed)
base_y0 = -55;  base_y1 = 80;
lap_x   = 100;                 // stands' feet lie over x 100..125
lap_low = 3;                   // base keeps its lower 3 mm there
tongue_top = 4;
dt_x  = 112.5;                 // dovetail rail centre
dt_wb = 10;  dt_wt = 12.2;     // rail width at the bottom / top (about 20 degree flanks)
dt_h  = base_t - lap_low;      // 3
dt_fit = 0.25;                 // clearance per face (11-12: 0.2 -> 0.25, a 135 mm slide binds easily;
                               // Tim's carriage-plate stage pocket at 0.3 a side fit "perfectly")
dt_stop = 5;                   // rail ends this far before the back edge = the stop
motor_w = 42.3;  motor_fit = 0.4;  cage_wall = 3;
// Base 2 (11-13): the motor cage moved toward the rods (Tim: "reprint the flat plate board with the
// motor holder moved closer to the beams") and the motor slides in it instead of sitting on a fixed
// stop, because the pen's real distance from the rods is still not measured (see carriage_d).
cage_y    = 9;                 // middle of the motor's travel: 20 mm behind the first print's centre (-11)
motor_adj = 10;                // travel each way: shaft at y -1..19 = 10 to 30 mm behind the first print
stop_w  = 6;  stop_t = 3;      // back-stop ribs = the back end of the travel (motor plug passes between them)
boss_w  = 23.5;  boss_h = 3;   // channel under the roof for the motor's 22 x 2 boss
shaft_w = 8;                   // slot through the roof for the 5 mm shaft
assert(abs(pen_y - cage_y) <= motor_adj, "the pen line is outside the platter motor's travel");
ard_x = 40;  ard_y = 76;       // Uno: left edge, USB end (USB + 12 V jack face the back)
uno_pad = 3;                   // room under the board for its solder pins; the lips are set from it

module obround(d, h, ext) hull() for (y = [-ext, ext]) translate([0, y, 0]) cylinder(d = d, h = h);
module dt_profile(c = 0) polygon([[dt_x - dt_wb / 2 - c, -dt_h - 0.01], [dt_x + dt_wb / 2 + c, -dt_h - 0.01],
                                  [dt_x + dt_wt / 2 + c, c], [dt_x - dt_wt / 2 - c, c]]);
module along_y(y0, y1) translate([0, y1, 0]) rotate([90, 0, 0]) linear_extrude(y1 - y0) children();
// The groove cut into a stand (drawn for the right one). Design review 11-12: a stand prints lying
// on its outer face, so -x is up on the printer and the groove's inner side is a ceiling. As a
// mirror of the rail's undercut, that side started printing at its free tip, in mid-air, 135 mm
// long, on a 0.25 mm sliding fit. Now only the OUTER flank is undercut (it prints as a plain slope,
// and it is the one that holds the stand down); the inner side is a 0.4 mm land against the rail's
// top corner (it stops the stand moving outward, so the outer hook can't come unhooked), then a
// 45 degree relief that prints clean.
dt_land = 0.4;      // one print line wide: any more hangs in the air and sags into the fit
module dt_groove(c = dt_fit) {
  xi = dt_x - dt_wt / 2 - c;  zl = c - dt_land;
  polygon([[dt_x + dt_wb / 2 + c, -dt_h - 0.01], [dt_x + dt_wt / 2 + c, c], [xi, c], [xi, zl],
           [xi - (zl + dt_h), -dt_h - 0.01]]);
}

module motor_cage() {          // origin = the middle of the motor's travel, on the base top
  in = motor_w / 2 + motor_fit;  out = in + cage_wall;
  ly = motor_w / 2 + motor_adj + stop_t;       // half length: the motor's body at either end of its travel
  difference() {
    union() {
      for (s = [-1, 1]) translate([s > 0 ? in : -out, -ly, 0]) cube([cage_wall, 2 * ly, face_z]);
      translate([-out, -ly, face_z]) cube([2 * out, 2 * ly, cage_top]);
      // Two ribs at the back corners stop the motor at the back end of its travel (the first print's
      // ribs were the one fixed position, 11-11 "push it in ... until it hits the edge"; that
      // position was wrong by about an inch). The middle stays open for the motor's plug.
      for (s = [-1, 1]) translate([s > 0 ? in - stop_w : -in, ly - stop_t, 0]) cube([stop_w, stop_t, face_z]);
    }
    // The motor slides in from the front with its shaft up: a slot for the shaft through the roof
    // and a channel for the boss in the roof's underside, both open to the front. (The first print
    // had one 23.5 mm slot right through; with the longer screw slots that left the roof as two
    // loose strips, so the roof now stays whole above the boss.)
    hull() for (y = [-ly - shaft_w, motor_adj]) translate([0, y, face_z - 1]) cylinder(d = shaft_w, h = cage_top + 2);
    hull() for (y = [-ly - boss_w, motor_adj]) translate([0, y, face_z - 1]) cylinder(d = boss_w, h = boss_h + 1);
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx * 15.5, sy * 15.5, 0]) {
      translate([0, 0, face_z - 1]) obround(3.4, cage_top + 2, motor_adj);      // screw slots
      translate([0, 0, cage_z - 3.5]) obround(6.5, 4, motor_adj);               // heads sunk
    }
  }
}

// Uno slides in (Tim 11-11: "an indent or something where it can fit nicely ... a little overhang
// so that we can slide the arduino in"): a snug pocket open at the back (USB end), two overhanging
// lips along the long sides, and the closed front wall is the stop. No pegs, no screws.
// Lips cover 0.5 mm of board edge; the Uno's headers start ~1.2 mm in from its long edges.
// Base 2 (Tim 11-13): the first print had four round pads under the board's mounting holes, and the
// pins under his Uno caught on them ("keep it exactly the same but without those tiny 4 little
// circle stands"). The pads are gone and nothing else moved: the board rests on its own pins.
uno_w = 53.34;  uno_l = 68.58;  uno_fit = 0.3;  uno_wall = 2;
lip_over = 0.8;  lip_t = 1.2;  lip_from = 18;    // lips start 18 mm from the USB end (clear the jacks)
module tray() {
  x0 = ard_x - uno_fit - uno_wall;  x1 = ard_x + uno_w + uno_fit + uno_wall;
  yf = ard_y - uno_l - uno_fit;                      // inner face of the front wall (the stop)
  zb = uno_pad + 1.6 + 0.2;                          // lip underside, just above the board
  difference() {
    translate([x0, yf - uno_wall, 0]) cube([x1 - x0, ard_y - yf + uno_wall, zb + lip_t]);
    translate([x0 + uno_wall, yf, -1]) cube([x1 - x0 - 2 * uno_wall, ard_y - yf + 1, zb + lip_t + 2]);
  }
  for (s = [0, 1]) translate([s == 0 ? x0 + uno_wall - 0.01 : ard_x + uno_w + uno_fit - lip_over, yf, zb])
    cube([lip_over + 0.01, ard_y - lip_from - yf, lip_t]);                     // the overhangs
}

module frame_base() difference() {
  union() {
    translate([-lap_x, base_y0, -base_t]) cube([2 * lap_x, base_y1 - base_y0, base_t]);
    for (s = [-1, 1]) mirror([s < 0 ? 1 : 0, 0, 0]) {
      translate([lap_x - 0.01, base_y0, -base_t]) cube([base_x - lap_x + 0.01, base_y1 - base_y0, lap_low]);
      along_y(base_y0, base_y1 - dt_stop) dt_profile();                         // the rail
    }
    translate([0, cage_y, 0]) motor_cage();
    tray();
  }
}

// ---------- stands (built as the right one; the left is its mirror with the idler) ----------
col_x0 = 148;  col_x1 = 170;
col_y0 = 32.5; col_y1 = 64;            // front face = the X motor's mounting face
arm_x0 = rod_len / 2 - 22;
arm_h  = 22;
rod_hole = 8.2;
mx = 128;
// Pre-print check 11-11: the app only ever puts the pen on ONE side of the centre (s >= 0 in
// polar.js) and needs 90 mm of it (180 mm drawing). With the idler at 119 the bearing blocks hit
// its fork at 78 mm; at 133 that side is clear to ~99 mm (where the plate meets the arm). The
// motor side stops at 78 mm (plate meets the motor flange), so the pen draws on the IDLER side.
ix = rod_len / 2 - 17;
cheek_t = 4;  idler_gap = 14;
// Idler (Tim 11-12: buy a bearing idler; the printed pulley on bolt threads hums and wears, like the
// old nail). Bought GT2 20T idler, 3 mm bore, ball bearings inside. Two printed spacers fill the
// fork's gap and press ONLY on the bearing's inner ring (small diameter), so the bolt can be done up
// tight while the outside spins. MEASURE the idler's total width and set idler_w (8.5 assumed).
idler_w  = 8.5;
idler_slot = 4;                                // tensioner travel outward (takes up 8 mm of belt)
spacer_t = (idler_gap - idler_w) / 2 - 0.1;   // 0.2 total play
module idler_spacer() difference() { cylinder(d = 5.2, h = spacer_t, $fn = 48); translate([0, 0, -1]) cylinder(d = 3.4, h = spacer_t + 2, $fn = 24); }

module tri_x(x0, w, pts) translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(w) polygon(pts);
module m3_nut_pocket(depth) cylinder(d = 6.4, h = depth, $fn = 6);

// Design review 11-12: the stand's two faces that look at the base's step (x = 100) and at the
// base's outer edge (x = 125, where the base's first layers squash outward on the bed) were drawn
// touching, so any print error there ate the rail's 0.25 clearance. They now stand foot_gap clear;
// the rail alone places the stand.
foot_gap = 0.3;
module stand_body() {
  translate([lap_x + foot_gap, base_y0, -lap_low]) cube([base_x - lap_x + 0.01, base_y1 - base_y0, lap_low + tongue_top]);
  translate([base_x + foot_gap, base_y0, -base_t]) cube([col_x1 - base_x - foot_gap, base_y1 - base_y0, base_t + tongue_top]);
  translate([col_x0, col_y0, 0]) cube([col_x1 - col_x0, col_y1 - col_y0, rod_hi + arm_h / 2]);
  for (z = [rod_lo, rod_hi]) translate([arm_x0, col_y0, z - arm_h / 2]) cube([col_x0 - arm_x0 + 0.01, col_y1 - col_y0, arm_h]);
  // front gusset: one 10 mm web on the outer side (x 160..170 = on the bed when the stand prints). An inner one at
  // x 148..154 printed as a 6 mm slab hanging over air (pre-print check 11-11), so it went.
  tri_x(160, 10, [[col_y0 + 0.01, tongue_top - 0.01], [-40, tongue_top - 0.01], [col_y0 + 0.01, 94]]);
  tri_x(164, 6, [[col_y1 - 0.01, tongue_top - 0.01], [base_y1, tongue_top - 0.01], [col_y1 - 0.01, 50]]);
}
module stand_holes() {
  for (z = [rod_lo, rod_hi]) translate([arm_x0 - 0.01, rod_y, z]) rotate([0, 90, 0]) {
    cylinder(d = rod_hole, h = rod_len / 2 - arm_x0 + 2, $fn = 96);    // 2 mm spare: rods up to 304 fit
    cylinder(d1 = rod_hole + 1.2, d2 = rod_hole, h = 0.6, $fn = 96);
  }
  along_y(base_y0 - 1, base_y1 - dt_stop) dt_groove();   // groove, closed at the back: its end meets the rail's end, so the rods land exactly on rod_y
  // flared mouth at the front (the end that goes onto the rail first), so both stands start easily
  hull() { along_y(base_y0 - 1, base_y0 - 0.9) dt_groove(dt_fit + 0.8); along_y(base_y0 + 5, base_y0 + 5.1) dt_groove(); }
}
module motor_flange() difference() {
  translate([mx - motor_w / 2, col_y0, belt_z - motor_w / 2]) cube([col_x0 - (mx - motor_w / 2) + 0.01, 4, motor_w]);
  translate([mx, col_y0 - 1, belt_z]) rotate([-90, 0, 0]) {
    cylinder(d = 10, h = 6);
    translate([0, 0, 0.99]) cylinder(d = 23.5, h = 2.2);
    for (sx = [-1, 1], sz = [-1, 1]) translate([sx * 15.5, sz * 15.5, 0]) cylinder(d = 3.4, h = 6, $fn = 24);
  }
}
module idler_fork() difference() {
  for (y = [rod_y - idler_gap / 2 - cheek_t, rod_y + idler_gap / 2]) hull() {
    translate([ix, y, belt_z]) rotate([-90, 0, 0]) cylinder(r = 11, h = cheek_t);
    translate([col_x0, y, belt_z - 11]) cube([0.01, cheek_t, 22]);
  }
  // Belt tensioner (Tim 11-12, "how should we attach the bearing"): the bolt sits in a slot that
  // runs idler_slot mm outward, so pulling the idler outward before tightening takes up 2 x that
  // much belt. The nut's pocket is a slot too: it slides with the bolt but can't turn.
  hull() for (dx = [0, idler_slot]) translate([ix + dx, rod_y - 20, belt_z]) rotate([-90, 0, 0]) cylinder(d = 3.4, h = 40, $fn = 24);
  hull() for (dx = [0, idler_slot]) translate([ix + dx, rod_y + idler_gap / 2 + cheek_t - 2.5, belt_z]) rotate([-90, 0, 0]) cylinder(d = 6.6, h = 3, $fn = 6);
}
module stand_right() difference() { union() { stand_body(); motor_flange(); } stand_holes(); }
module stand_left() mirror([1, 0, 0]) difference() { union() { stand_body(); idler_fork(); } stand_holes(); }

// ---------- platter wheel ----------
ring_in = 96;  ring_out = 101.5;
lip_in  = disc_d / 2 + 0.15;           // the disc drops into this lip: centred to 0.15 mm
lip_h   = disc_t - 0.2;                // lip stays 0.2 below the disc top, so the clamp presses the disc
bead_out = 102.5;  bead_z = w_h - 6;   // catch for the clamp ring's hooks (flat underside)
// 11-12 (Tim skips the fit test, "make the dimensions as perfect as possible"): bore 0.15 -> 0.25
// (small upright holes print ~0.1-0.2 under), nut slot 2.6 -> 2.8 thick, screw holes 3.2 -> 3.4.
shaft_d = 5;  shaft_flat = 4.5;  bore_fit = 0.25;
nut_x = 4.0;  nut_t = 2.8;  nut_w = 5.8;
// Shaft collar (separate print). Wheel coordinates: z 0 = wheel underside. It spans
// z col_z0..col_z1 = 1..15.5. Socket and collar are drawn the same size, so the taper must wedge
// before the collar's top hits the socket ceiling (2.1 above it), or the hex turns with play.
// Design review 11-12:
// - The taper was 2.8 degrees a side, where 0.1 mm of print error per side moves the wheel 2 mm.
//   Now 19 -> 16.5 across the flats (4.9 degrees a side: 1.2 mm per 0.1 mm, still self-locking,
//   easier to pull off). Printed sockets run small, so expect the wheel 0.5-2 mm above nominal:
//   harmless (the pen's height is set in its clip).
// - The collar's height on the shaft is set by collar_gauge (collar underside wheel_gap + col_z0
//   above the cage top), not by the shaft tip. Tim's 23.5 shaft then ends flush with the collar's
//   top; any shaft from 21 to 25.4 works (top screw still on it / tip still under the wheel skin).
// - Its bottom edge is chamfered: the first layers squash outward on the bed, and a flared foot
//   would be the only thing touching the socket (wheel rocks).
col_z0 = 1;  col_z1 = w_h - 2.5;  col_af0 = 19;  col_af1 = 16.5;
sock_top = w_h - 0.4;                  // socket ceiling, under the wheel's top skin
set_z = [col_z0 + 4, col_z1 - 4];      // collar screws, 6.5 mm apart (4 and 10.5 below the shaft tip)
// Collar screws (Tim 11-12: "I just got 8 M3 8mm screws", pan-head Phillips, used instead of grub
// screws). Tightened, the tip sits on the shaft's flat, so the head stands proud of the collar's
// +x face; the wheel's socket has a channel, open at the bottom, that the heads slide up into
// (they also key the wheel to the collar). Sizes: ISO 7045 M3 pan head, 5.6 wide x 2.4 tall.
scr_len = 8;  scr_head_d = 5.6;  scr_head_k = 2.4;
chan_w  = scr_head_d + 1.4;                          // channel width (y)
chan_x  = shaft_flat + bore_fit - (shaft_d + bore_fit) / 2 + scr_len + scr_head_k + 1;   // head top + 1 = 13.5
chan_z  = set_z[1] + scr_head_d / 2 + 2.2;           // channel top: as much room over the upper head as
                                                     // the collar has under the socket ceiling
hub_d   = 2 * (chan_x + 3);                          // 3 mm of wall outside the channel (33)
function col_af(z) = col_af0 + (col_af1 - col_af0) * (z - col_z0) / (col_z1 - col_z0);
module collar_shape(z0, z1) hull() for (z = [z0, z1]) translate([0, 0, z]) rotate(30)
  cylinder(d = col_af(z) * 2 / sqrt(3), h = 0.01, $fn = 6);     // flats face +-x
module shaft_collar() difference() {     // built in wheel coordinates
  hull() {
    collar_shape(col_z0 + 0.6, col_z1);
    translate([0, 0, col_z0]) rotate(30) cylinder(d = (col_af(col_z0) - 1) * 2 / sqrt(3), h = 0.01, $fn = 6);
  }
  fx = shaft_flat + bore_fit - (shaft_d + bore_fit) / 2;
  translate([0, 0, col_z0 - 1]) intersection() {
    cylinder(d = shaft_d + bore_fit, h = col_z1 - col_z0 + 2);
    translate([-shaft_d, -shaft_d, 0]) cube([shaft_d + fx, 2 * shaft_d, col_z1 - col_z0 + 2]);
  }
  for (z = set_z) translate([0, 0, z]) rotate([0, 90, 0]) cylinder(d = 3.4, h = 20, $fn = 24);
  // one nut slot from the collar's underside up past the top screw: top nut first, then the bottom
  translate([nut_x, -nut_w / 2, col_z0 - 1]) cube([nut_t, nut_w, set_z[1] + 3 - col_z0 + 1]);
}
// Tim 11-11: the disc was only held by friction. Default now: the platter face is PART OF THE
// WHEEL (a solid top skin, printed face-down on the bed so it comes out flat). Paper is pinched
// between that face and the clamp ring, and the ring's hooks sit between ribs on the wheel, so
// nothing can slip. platter = "disc" brings back the aluminium-disc version (lip + friction).
platter = "printed";
top_t   = 2;                           // printed platter skin; its top is where the disc top was
hook_ang = [45, 135, 225, 315];        // clamp ring hooks (16 degrees wide each); off the collar
                                       // screws at 0 degrees
// Soft pad under the paper (Tim 11-11: vinyl "so that the pen can push slightly further"). It lies
// on the flat face, cut to the platter's size, and the clamp ring pinches pad + paper together, so
// the hooks are pad_t longer. (A pocket for it was tried and dropped: the face prints on the bed,
// so a pocket's floor would print in mid-air.) MEASURE Tim's sheet; 0 = no pad.
pad_t   = 1;
module platter_wheel() {
  fx = shaft_flat + bore_fit - (shaft_d + bore_fit) / 2;
  difference() {
    union() {
      cylinder(d = hub_d, h = w_h);
      for (a = [30 : 60 : 330]) rotate(a) translate([0, -2.5, 0]) cube([ring_in + 1, 5, w_h]);
      difference() { cylinder(r = ring_out, h = w_h, $fn = 240); translate([0, 0, -1]) cylinder(r = ring_in, h = w_h + 2, $fn = 240); }
      if (platter == "disc")
        translate([0, 0, w_h - 0.01]) difference() { cylinder(r = ring_out, h = lip_h + 0.01, $fn = 240); translate([0, 0, -1]) cylinder(r = lip_in, h = 3, $fn = 240); }
      else
        translate([0, 0, w_h + disc_t - top_t]) cylinder(r = ring_out, h = top_t, $fn = 240);   // the platter face
      rotate_extrude($fn = 240) polygon([[ring_out - 0.01, bead_z], [bead_out, bead_z], [bead_out, bead_z + 1], [ring_out - 0.01, bead_z + 2]]);
      // key ribs either side of each hook: the clamp ring can't turn on the wheel
      for (a = hook_ang, s = [-1, 1]) rotate(a + s * 8.6) translate([ring_out - 0.01, s > 0 ? 0 : -2, bead_z + 2])
        cube([bead_out - 0.1 - ring_out + 0.01, 2, w_h + (platter == "disc" ? 0 : disc_t) - bead_z - 2]);
    }
    // Hex taper socket for the shaft collar (11-12: the set screws used to be in this hub, 95 mm in
    // from the rim, which no normal hex key reaches). The collar goes on the shaft first, screws
    // tightened in the open, then the wheel is pressed down onto it: the hex turns it, the taper
    // wedges tight, so there is no play and no tilt. Pull up to take the wheel off.
    translate([0, 0, -0.01]) collar_shape(0, sock_top + 0.01);
    translate([0, -chan_w / 2, -0.01]) cube([chan_x, chan_w, chan_z + 0.01]);   // screw-head channel
    // room for a shaft tip up to 0.8 above the socket ceiling (0.6 of skin stays, printed on the bed)
    if (platter != "disc") translate([0, 0, sock_top - 0.01]) cylinder(d = shaft_d + 0.8, h = w_h + disc_t - 0.6 - sock_top + 0.01);
  }
}

// ---------- clamp ring: holds the paper AND the disc down; 4 hooks snap under the wheel's bead ----------
// Built with z = 0 at its underside (which sits on the paper). Covers r 92..100 of the paper, so
// draw inside r ~90 (same as the old paper ring).
paper_t = 0.1;
cr_in = 92;  cr_out = 104.2;  cr_t = 1.2;
preload = 0.2;                         // hooks are this much short, so they pull the ring down
module clamp_ring() {
  hook_top = -(disc_t + (platter == "disc" ? 0 : pad_t) + paper_t + (bead_z - w_h) * -1) + preload;   // catch's top face, below the ring
  difference() { cylinder(r = cr_out, h = cr_t, $fn = 240); translate([0, 0, -1]) cylinder(r = cr_in, h = cr_t + 2, $fn = 240); }
  for (a = hook_ang) rotate(a - 8) rotate_extrude(angle = 16, $fn = 240)
    polygon([[cr_out, 0.01], [cr_out, hook_top - 1.6], [bead_out - 0.1, hook_top - 1.6],
             [bead_out - 0.8, hook_top - 0.9], [bead_out - 0.8, hook_top], [bead_out + 0.2, hook_top], [bead_out + 0.2, 0.01]]);
}

// ---------- assembly ----------
c_print = "#e07a35";  c_wheel = "#2f8fb3";  c_metal = "#b9c0c6";  c_dark = "#4a4f55";
module assembly() {
  color(c_print) frame_base();
  color(c_print) stand_right();
  color(c_print) stand_left();
  color(c_wheel) translate([0, pen_y, wheel_z0]) platter_wheel();
  color("#e0a020") translate([0, pen_y, wheel_z0]) shaft_collar();
  if (show_disc) {
    if (platter == "disc") color(c_metal) translate([0, pen_y, wheel_top]) cylinder(d = disc_d, h = disc_t, $fn = 160);
    pz = plate_top + (platter == "disc" ? 0 : pad_t);
    if (platter != "disc" && pad_t > 0) color("#555") translate([0, pen_y, plate_top]) cylinder(d = disc_d, h = pad_t, $fn = 160);
    color("white") translate([0, pen_y, pz + 0.05]) cylinder(d = disc_d - 4, h = paper_t, $fn = 160);
    color("#1f5f7a") translate([0, pen_y, pz + paper_t + 0.1]) clamp_ring();
  }
  color(c_dark) translate([0, pen_y, face_z]) nema17();
  color(c_dark) translate([mx, col_y0, belt_z]) rotate([-90, 0, 0]) rotate([0, 0, 180]) nema17();
  color(c_metal) for (z = [rod_lo, rod_hi]) translate([-rod_len / 2, rod_y, z]) rotate([0, 90, 0]) cylinder(d = 8, h = rod_len);
  color(c_wheel) translate([-ix, rod_y - 5.075, belt_z]) rotate([-90, 0, 0]) pulley_m3();
  translate([0, 0, lift]) {
    color(c_metal) blocks();
    color(c_print) carriage_plate();
    color("#d8d8d0") { stage(); slider(); }
    color(c_print) { pen_clip(); knob(); }
    color("#c03030") the_pen();
    color(c_dark) x_belt();
    color(c_metal) x_pulley();
  }
  color("#2a6db0") translate([ard_x, ard_y, uno_pad]) rotate(-90) { uno(); drivers(); }
}
module exploded() {
  color(c_print) frame_base();
  color(c_print) translate([0, -90, 30]) stand_right();
  color(c_print) translate([0, -90, 30]) stand_left();
  color(c_wheel) translate([0, pen_y, wheel_z0 + 45]) platter_wheel();
  color(c_wheel) translate([0, pen_y, wheel_z0 + 95]) clamp_ring();
}
// a cut through the wheel's rim: wheel, disc, paper, clamp ring hook
module rim_section() intersection() {
  translate([88, -4, -20]) cube([24, 8, 40]);
  union() {
    color(c_wheel) platter_wheel();
    color(c_metal) translate([0, 0, w_h]) cylinder(d = disc_d, h = disc_t, $fn = 240);
    color("white") translate([0, 0, w_h + disc_t]) cylinder(d = disc_d - 4, h = paper_t, $fn = 240);
    color("#1f5f7a") translate([0, 0, w_h + disc_t + paper_t]) rotate(8) clamp_ring();
  }
}
// one hook of the clamp ring lifted above its slot between the two key ribs
module key_demo() intersection() {
  rotate(45) translate([70, -30, -5]) cube([40, 60, 50]);
  union() {
    color(c_wheel) platter_wheel();
    color("#1f5f7a") translate([0, 0, w_h + disc_t + 12]) clamp_ring();
  }
}
// motor going into its cage from the front
module cage_demo() {
  color(c_print) intersection() { frame_base(); translate([-36, -80, -10]) cube([72, 130, 70]); }
  color(c_dark) translate([0, pen_y - 55, face_z]) nema17();
  color("#2f8fb3") translate([0, pen_y - 30, face_z + 30]) rotate([90, 0, 0]) linear_extrude(1) text("slides in", size = 7, halign = "center");
}

// ~50-minute test print before the big ones: a piece of base rail (printed flat, like the base), the
// matching stand groove and one rod hole (printed standing, like the stands), and a slice of the wheel
// hub's hex socket. Print the collar with it. Check: groove slides on the rail, a rod goes in snug,
// the shaft goes in the collar, the collar presses into the socket.
module fit_test() {
  translate([-100, -45, 6]) intersection() { frame_base(); translate([101, 45, -6.5]) cube([23, 25, 7.5]); }
  translate([33, 0, 124]) rotate([0, 90, 0]) translate([0, -45, 0])
    intersection() { stand_right(); translate([101, 45, -lap_low - 1]) cube([23, 25, lap_low + tongue_top + 2]); }
  translate([50, 0, 155]) rotate([0, 90, 0]) translate([0, -40, -rod_lo])
    intersection() { stand_right(); translate([127, 40, rod_lo - 8]) cube([28, 20, 16]); }
  translate([88, 16, 0]) intersection() { platter_wheel(); cylinder(d = hub_d + 1, h = 10); }   // the collar's socket
}

// Setting gauge (design review 11-12): lies on the cage top across the shaft slot; the collar is
// pushed down onto it, its screws tightened, and the gauge pulled out toward the front. Puts the
// collar's underside wheel_gap + col_z0 above the cage whatever the shaft's length. 14 mm wide, so
// it passes between the cage's screw heads (y = +-15.5). Origin = the shaft; the tab is the handle.
module collar_gauge() difference() {
  translate([-22, -7, 0]) cube([62, 14, wheel_gap + col_z0]);
  hull() for (y = [0, 10]) translate([0, y, -1]) cylinder(d = shaft_d + 1, h = wheel_gap + col_z0 + 2);
}
// Washers for the platter motor's 4 screws (design review 11-12): the cage roof is 2.5 mm under
// the sunk heads, so an M3x8 would reach 5.5 mm into the motor, whose threads are ~4.5 deep: it
// bottoms out and the motor stays loose. With one of these under each head it reaches 4.0.
// Not needed with M3x6 screws. 6 = 4 + 2 spares.
washer_t = 1.5;
module motor_washers() for (i = [0 : 5]) translate([i * 8, 0, 0])
  difference() { cylinder(d = 6, h = washer_t, $fn = 48); translate([0, 0, -1]) cylinder(d = 3.4, h = washer_t + 2, $fn = 24); }

module print_stand_right() translate([0, 0, col_x1]) rotate([0, 90, 0]) stand_right();
module print_stand_left()  translate([0, 0, col_x1]) rotate([0, -90, 0]) stand_left();
module print_wheel()       translate([0, 0, w_h + disc_t]) rotate([180, 0, 0]) platter_wheel();   // platter face on the bed
module print_clamp_ring()  translate([0, 0, cr_t]) rotate([180, 0, 0]) clamp_ring();

if (part == "assembly")    assembly();
if (part == "exploded")    exploded();
if (part == "rim")         rim_section();
if (part == "cage")        cage_demo();
if (part == "base")        frame_base();
if (part == "stand_right") stand_right();
if (part == "stand_left")  stand_left();
if (part == "wheel")       platter_wheel();
if (part == "clamp_ring")  clamp_ring();
if (part == "print_stand_right") print_stand_right();
if (part == "print_stand_left")  print_stand_left();
if (part == "print_clamp_ring")  print_clamp_ring();
if (part == "print_wheel")       print_wheel();
if (part == "key")               key_demo();
if (part == "fit_test")          fit_test();
if (part == "collar")            shaft_collar();
if (part == "print_collar")      translate([0, 0, -col_z0]) shaft_collar();
if (part == "idler_spacers")     for (x = [0, 8]) translate([x, 0, 0]) idler_spacer();
if (part == "collar_gauge")      collar_gauge();
if (part == "motor_washers")     motor_washers();

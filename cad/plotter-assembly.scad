// The whole plotter, assembled, for the 3D build guide (build.html).
// Layout follows the Instructables "Polar CNC Plotter V2" and Tim's photos (docs/photos/); printed parts
// are Tim's (plotter-parts.scad); bought parts are modelled at their catalogue sizes. Positions not
// measured on the real machine are approximate.
// One part at a time: openscad -D 'part="rods"' (tools/make-build-model.py exports them all).
// Multi-colour parts are split into pieces: -D 'part="x_motor"' -D 'sub="caps"'.
// Motor wires and the paper clip are drawn in js/build.js (smooth tubes are easier there).
// World: X along the rail, Y toward the back, Z up. Board top is z = 0, platter centre is x = 0.

use <plotter-parts.scad>

part = "all";
sub = "";              // one coloured piece of a part; "" = all of it
$fn = 48;
module piece(n) if (sub == "" || sub == n) children();

// ---------- layout ----------
stand_x  = 150;        // stands 300 mm apart (guide)
rod_y    = 50;         // rods' plane, near the back of the board
rod_lo   = 75;         // lower rod (tee) height
rod_hi   = 137;        // upper rod (elbow) height
belt_z   = (rod_lo + rod_hi) / 2;
fit_r    = 13.5;       // 1/2" PVC fitting outer radius
pipe_d   = 21.3;       // 1/2" PVC pipe outer diameter
belt_y   = rod_y;      // X belt plane: in line with the rods, between the bearing blocks (Tim, 2026-10-25)
mx       = 128;        // X motor shaft (motor sits in front of the right stand, label facing out)
ix       = -stand_x + fit_r + 17.38;   // idler axle, from the bracket's hole height
plate_z  = 26;         // rotary plate rests on 26 mm spacers
carriage_x = 0;
block_face = rod_y - 11;            // SC8UU mounting face (rod centre is 11 mm behind it)
stage_front = block_face - 2 - 20;  // carriage plate 2 mm, linear stage 20 mm deep
pen_y    = stage_front - 14 - 23 + 8.5;  // slider 14 deep, clip 23 deep, pen 8.5 into the clip
platter_z = 40;
motor_off = 68;        // 20T to 60T centre distance for a 220 mm GT2 loop

// ---------- bought parts ----------
module nema_sq(h, s = 42.3) linear_extrude(h) offset(delta = 4.5, chamfer = true) square(s - 9, center = true);
module nema17(shaft = 24) {         // mount face at z = 0, body below, shaft up, connector on +y
  piece("caps") {                   // aluminium end caps
    difference() {
      translate([0, 0, -8]) nema_sq(8);
      for (x = [-15.5, 15.5], y = [-15.5, 15.5]) translate([x, y, -4]) cylinder(d = 3, h = 5, $fn = 16);
    }
    translate([0, 0, -38]) difference() {
      nema_sq(7);
      for (x = [-15.5, 15.5], y = [-15.5, 15.5]) translate([x, y, -1]) cylinder(d = 5.5, h = 2, $fn = 16);
    }
    cylinder(d = 22, h = 2);
  }
  piece("body") translate([0, 0, -31]) intersection() {   // laminated stack: fine grooves
    nema_sq(23, 41.4);
    union() for (z = [0 : 1.2 : 22.8]) translate([-25, -25, z]) cube([50, 50, 0.9]);
  }
  piece("core") translate([0, 0, -31]) nema_sq(23, 40.6);
  piece("screws") for (x = [-15.5, 15.5], y = [-15.5, 15.5]) translate([x, y, -38.6]) cylinder(d = 5, h = 0.8, $fn = 16);
  piece("plug") translate([-8, 20.7, -21]) difference() {   // white JST connector
    cube([16, 6, 9]);
    for (i = [0 : 3]) translate([2 + i * 3.5, 2, 1.5]) cube([2, 5, 6]);
  }
  piece("label") translate([0, 0, -38.3]) cylinder(d = 30, h = 0.3);
  piece("shaft") difference() {
    cylinder(d = 5, h = shaft, $fn = 24);
    translate([2, -3, 3]) cube([5, 6, shaft]);              // D flat
  }
}
module gt2_16t() {                  // aluminium pulley: flange, 16 teeth, flange, set-screw hub (z 0..16)
  cylinder(d = 16, h = 1);
  translate([0, 0, 1]) difference() {
    cylinder(d = 10.2, h = 7);
    for (i = [0 : 15]) rotate(i * 360 / 16) translate([5.1, 0, -1]) cylinder(d = 1.3, h = 9, $fn = 8);
  }
  translate([0, 0, 8]) cylinder(d = 16, h = 1);
  translate([0, 0, 9]) difference() {
    cylinder(d = 13, h = 7);
    for (a = [0, 90]) rotate(a) translate([0, 0, 3.5]) rotate([0, 90, 0]) cylinder(d = 3, h = 8, $fn = 12);
  }
}
module sc8uu() {                    // 30 along the rod (x), 34 tall (z), 22 deep (y); rod 11 behind the face
  difference() {
    hull() {
      translate([-15, 0, -17]) cube([30, 14, 34]);
      translate([-15, 0, -12]) cube([30, 22, 24]);
    }
    translate([-16, 11, 0]) rotate([0, 90, 0]) cylinder(d = 8.4, h = 32);
    for (x = [-9, 9], z = [-12, 12]) translate([x, -1, z]) rotate([-90, 0, 0]) cylinder(d = 3.4, h = 9, $fn = 12);
    for (z = [-17.5, 16.5]) translate([-16, -1, z]) cube([32, 24, 1]);   // edge breaks
  }
}
// closed GT2 loop in the XY plane (z 0..w) with teeth on the inside straight runs
module belt_loop(x1, r1, x2, r2, w = 6, t = 1.1) {
  linear_extrude(w) {
    difference() {
      hull() { translate([x1, 0]) circle(r1 + t, $fn = 64); translate([x2, 0]) circle(r2 + t, $fn = 64); }
      hull() { translate([x1, 0]) circle(r1, $fn = 64); translate([x2, 0]) circle(r2, $fn = 64); }
    }
    for (s = [-1, 1]) {
      a = [x1, s * r1]; b = [x2, s * r2]; L = norm(b - a); ang = atan2(b[1] - a[1], b[0] - a[0]);
      for (d = [1 : 2 : L - 1]) translate(a + (b - a) * d / L) rotate(ang) translate([-0.55, s > 0 ? -0.7 : 0]) square([1.1, 0.75]);
    }
  }
}
// a straight belt run (2D) from inner-face point a to b; s = +1 teeth hang below the face, -1 stand above it
module run(a, b, s, t = 1.1, teeth = true) {
  n = [0, s * t];                                                  // the belt's back (runs are near level)
  polygon([a, b, b + n, a + n]);
  if (teeth) {
    L = norm(b - a);
    for (d = [1 : 2 : L - 1]) translate(a + (b - a) * d / L) translate([-0.55, s > 0 ? -0.7 : -0.05]) square([1.1, 0.75]);
  }
}
module ring_arc(c, r, t, side) translate(c) intersection() {      // half annulus; side = -1 left, +1 right
  difference() { circle(r + t, $fn = 64); circle(r, $fn = 64); }
  translate([side > 0 ? 0 : -r - t - 1, -r - t - 1]) square([r + t + 1, 2 * (r + t + 1)]);
}
// open GT2 belt (XZ plane, z = 0 at the pulley axes): over both pulleys, the lower run cut and each end
// wrapped round a carriage peg, folded back on itself and zip-tied (Tim, 2026-10-25)
module open_belt(x1, r1, x2, r2, pegs, peg_z, peg_r, w = 6, t = 1.1) {
  piece("belt") linear_extrude(w) {
    ring_arc([x1, 0], r1, t, -1);
    ring_arc([x2, 0], r2, t, 1);
    run([x1, r1], [x2, r2], 1);
    for (s = [-1, 1]) {
      x0 = s < 0 ? x1 : x2; r0 = s < 0 ? r1 : r2; px = pegs[s < 0 ? 0 : 1];
      a = [x0, -r0]; b = [px, peg_z - peg_r];                       // pulley bottom to under the peg
      run(a, b, -1);
      ring_arc([px, peg_z], peg_r, t, -s);                          // round the peg's far side
      fold = b + (a - b) * 16 / norm(a - b);                        // tail comes back over the peg and
      run([px, peg_z + peg_r], fold, 1, teeth = false);             // lies teeth-down on the run
      run(fold, b + (a - b) * 28 / norm(a - b), 1, teeth = false);
    }
  }
  piece("ties") for (s = [-1, 1]) {
    x0 = s < 0 ? x1 : x2; r0 = s < 0 ? r1 : r2; px = pegs[s < 0 ? 0 : 1];
    a = [x0, -r0]; b = [px, peg_z - peg_r];
    c = b + (a - b) * 22 / norm(a - b);
    translate([c[0], c[1] - t - 0.7, -0.8]) {
      difference() { translate([-1.25, 0, 0]) cube([2.5, 2 * t + 2.2, w + 1.6]); translate([-2, 0.7, 0.7]) cube([4, 2 * t + 0.8, w + 0.2]); }
      translate([-2.5, -2.6, w - 1.2]) cube([5, 2.6, 4]);             // the tie's square head
    }
  }
}
module linear_stage() {             // QINIZX 48 mm stroke stage, 25 x 81 x 20, slider on the front
  piece("frame") difference() {
    cube([25, 20, 75]);
    translate([3, -1, 4]) cube([19, 12, 67]);
    for (z = [12, 63]) translate([12.5, 21, z]) rotate([90, 0, 0]) cylinder(d = 3, h = 4, $fn = 12);
  }
  piece("screw") translate([12.5, 10, 4]) cylinder(d = 2.8, h = 67, $fn = 12);
  piece("rails") for (x = [5, 20]) translate([x, 10, 4]) cylinder(d = 2, h = 67, $fn = 10);
  piece("motor") translate([12.5, 10, 75]) { cylinder(d = 15, h = 11); translate([0, 0, 11]) cylinder(d = 6, h = 1.5); }
  piece("flex") translate([5, 17.5, 77]) cube([15, 0.3, 8]);       // the motor's little ribbon cable, down its back
}
module stage_slider() {
  piece("block") difference() {
    cube([25, 14, 10]);
    for (x = [7, 18]) translate([x, -1, 5]) rotate([-90, 0, 0]) cylinder(d = 2.5, h = 4, $fn = 10);
  }
  piece("nut") translate([12.5, 24, 0]) cylinder(d = 6, h = 10, $fn = 6);   // brass nut on the lead screw
}
module spindle() {                  // salvaged disc-drive spindle: stator board + rotor (z = 0 on the plate)
  piece("board") difference() {
    translate([-20, -18, 0]) cube([46, 36, 1.2]);
    translate([14, -16, -1]) cube([14, 2.5, 3]);
  }
  piece("pads") for (i = [0 : 7]) translate([12 + i * 1.6, 10, 1.2]) cube([0.9, 6, 0.1]);
  piece("rotor") {
    translate([0, 0, 1.2]) cylinder(d = 27.8, h = 8.3);
    cylinder(d = 10, h = 11.2);
  }
}
module uno() {                      // Arduino Uno + CNC shield V3 (shield on 11 mm headers)
  piece("uno") difference() {
    cube([68.6, 53.3, 1.6]);
    for (p = [[14, 2.5], [15.3, 50.7], [66.1, 7.6], [66.1, 35.5]]) translate([p[0], p[1], -1]) cylinder(d = 3.2, h = 4, $fn = 12);
  }
  piece("chips") {
    translate([30, 8, 1.6]) cube([35, 8, 3.5]);                    // ATmega328P
    translate([10, 40, 1.6]) cube([28, 2.5, 11.4]);                // headers up to the shield
    translate([42, 2, 1.6]) cube([24, 2.5, 11.4]);
    translate([-1.8, 3.3, 1.6]) cube([13.7, 9, 10.9]);             // power jack
  }
  piece("ports") {
    translate([-6.3, 32, 1.6]) cube([16, 12, 10.9]);               // USB-B
    translate([20, 22, 1.6]) cylinder(d = 6, h = 10);              // capacitors
    translate([20, 30, 1.6]) cylinder(d = 6, h = 10);
    translate([14, 12, 1.6]) cube([11, 4, 3.5]);                   // crystal
  }
  piece("shield") difference() {
    translate([0, 0, 13]) cube([68.6, 53.3, 1.6]);
    for (p = [[14, 2.5], [66.1, 35.5]]) translate([p[0], p[1], 12]) cylinder(d = 3.2, h = 4, $fn = 12);
  }
  piece("pins") for (i = [0 : 2]) translate([19 + i * 17, 40, 14.6]) cube([13, 2.5, 8]);   // motor headers
  piece("terminal") translate([4, 2, 14.6]) difference() {         // 12 V screw terminal
    cube([10, 7.5, 10]);
    for (x = [2.5, 7.5]) translate([x, 3.75, 7]) cylinder(d = 3, h = 4, $fn = 12);
  }
}
module drivers() for (i = [0 : 2]) translate([18 + i * 17, 16, 14.6]) {
  piece("drivers") { translate([0, 0, 2]) cube([15, 20, 1.6]); for (x = [0.5, 12]) translate([x, 1, 0]) cube([2.5, 18, 2]); }
  piece("heatsinks") translate([2, 4, 3.6]) for (j = [0 : 5]) translate([j * 2, 0, 0]) cube([1.2, 11, 7]);
  piece("pots") translate([7.5, 18, 3.6]) cylinder(d = 3, h = 1.5, $fn = 12);
}
module pen() {                      // Sharpie: black tip, red grip, grey barrel, red cap posted on top
  piece("tip") translate([0, 0, -8]) cylinder(d1 = 1.5, d2 = 3, h = 4);
  piece("cap") {
    translate([0, 0, -4]) cylinder(d1 = 3, d2 = 9, h = 4);
    translate([0, 0, 0]) cylinder(d = 9.5, h = 14);
    translate([0, 0, 95]) cylinder(d = 12, h = 30);
    translate([0, 0, 125]) cylinder(d1 = 12, d2 = 10, h = 2);
    translate([5.2, -1.5, 100]) cube([2.5, 3, 22]);                // pocket clip
  }
  piece("body") translate([0, 0, 14]) cylinder(d = 11, h = 81);
}

// ---------- stands ----------
module tube(d, h, id = 0) difference() { cylinder(d = d, h = h); if (id > 0) translate([0, 0, -1]) cylinder(d = id, h = h + 2); }
module socket(h, id = pipe_d) difference() {     // PVC fitting hub, mouth at z = 0: bevelled ends, a small bead
  union() {
    hull() { translate([0, 0, 0.8]) cylinder(r = fit_r, h = h - 1.6); cylinder(r = fit_r - 0.8, h = h); }
    translate([0, 0, 0.8]) cylinder(r = fit_r + 0.35, h = 2.2);
  }
  if (id > 0) translate([0, 0, -1]) cylinder(d = id, h = h - 1);
}
module arm(side) rotate([0, -side * 90, 0]) translate([0, 0, 27]) rotate([180, 0, 0]) socket(27);
module stand(side) {                // side = +1 right, -1 left
  translate([side * stand_x, rod_y, 0]) {
    translate([0, 0, 38]) rotate([180, 0, 0]) socket(38);            // coupling at the bottom
    cylinder(d = pipe_d, h = rod_hi);                                 // pipe
    translate([0, 0, rod_lo - 27]) socket(27);                        // tee
    translate([0, 0, rod_lo + 27]) rotate([180, 0, 0]) socket(27);
    translate([0, 0, rod_lo]) arm(side);
    translate([0, 0, rod_hi - 27]) socket(25);                        // elbow: two hubs and a round corner
    translate([0, 0, rod_hi]) sphere(r = fit_r);
    translate([0, 0, rod_hi]) arm(side);
  }
}
module screw_holders() for (s = [-1, 1]) translate([s * stand_x, rod_y, 0]) difference() {
  union() { cylinder(d = 20, h = 2); cylinder(d = 15, h = 15); }
  translate([0, 0, -1]) cylinder(d = 5, h = 17);
}
module spools() for (s = [-1, 1], z = [rod_lo, rod_hi])
  translate([s * (stand_x - 29), rod_y, z]) rotate([0, s * 90, 0]) spool();

// ---------- base ----------
module board() {
  piece("wood") difference() {
    translate([-200, -65, -5]) cube([400, 130, 5]);
    translate([-motor_off - 23, pen_y - 23, -6]) cube([46, 46, 7]);   // the platter motor sits through the board
  }
  piece("screws") for (x = [-188, 188], y = [-50, 50]) translate([x, y, 0]) {   // pan-head wood screws into the feet
    cylinder(d = 7, h = 1.2, $fn = 24);
    translate([0, 0, 1.2]) scale([1, 1, 0.35]) sphere(d = 7, $fn = 24);
  }
}
module bars() for (y = [-45, 45]) translate([-195, y - 7.5, -20]) cube([390, 15, 15]);

// ---------- rail + carriage ----------
module rods() for (z = [rod_lo, rod_hi]) translate([-150, rod_y, z]) rotate([0, 90, 0]) cylinder(d = 8, h = 300);
module blocks() for (x = [-15, 15], z = [rod_lo, rod_hi]) translate([carriage_x + x, block_face, z]) sc8uu();
// the plate's thick middle sits between the upper and lower bearing blocks; its pegs catch the lower belt run
module carriage_plate() translate([carriage_x - 28.5, block_face - 2, belt_z + 47.5]) rotate([-90, 0, 0]) base_plate();

// ---------- pen lift ----------
module stage() translate([carriage_x - 12.5, stage_front, 66]) linear_stage();
module slider() translate([carriage_x - 12.5, stage_front - 14, 100]) stage_slider();
module pen_clip() translate([carriage_x + 10, stage_front - 14 - 23, 100]) rotate([0, 0, 90]) clip();
module knob() translate([carriage_x, stage_front - 14 - 23, 105]) rotate([90, 0, 0]) gear();
module the_pen() translate([carriage_x, pen_y, platter_z + 9]) pen();

// ---------- X drive (motor in front of the right stand, as in docs/photos/full-machine.jpg) ----------
module x_motor_plate() translate([mx - 22.23, rod_y - fit_r, belt_z - 41]) rotate([90, 0, 0]) motor_plate_2();
module x_motor() translate([mx, rod_y - fit_r - 3, belt_z]) rotate([-90, 0, 0]) rotate([0, 0, 180]) nema17();
module x_pulley() translate([mx, belt_y + 4.5, belt_z]) rotate([90, 0, 0]) gt2_16t();   // hub toward the motor
module idler_bracket() translate([-stand_x + fit_r, belt_y - 9, belt_z - 17.5])
  multmatrix([[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]]) bracket();
module idler_pulley() translate([ix, belt_y - 5.075, belt_z]) rotate([-90, 0, 0]) pulley_a();
module idler_axle() translate([ix, belt_y - 10, belt_z]) rotate([-90, 0, 0]) {   // Tim's: a cut nail, tape on the cut end
  piece("nail") { translate([0, 0, -1]) cylinder(d = 6.5, h = 1, $fn = 24); cylinder(d = 3, h = 23, $fn = 16); }
  piece("tape") translate([0, 0, 19.5]) cylinder(d = 5.2, h = 4.5, $fn = 24);
}
peg_x = 19.5;                       // carriage pegs (base_plate x 9 and 48, plate centred on the carriage)
peg_z = belt_z + 47.5 - 55;
module x_belt() translate([0, belt_y + 3, belt_z]) rotate([90, 0, 0])
  open_belt(ix, 6.37, mx, 5.09, [carriage_x - peg_x, carriage_x + peg_x], peg_z - belt_z, 3.2);

// ---------- platter drive ----------
module rotary_plate() translate([-88, pen_y - 36.5, plate_z + 2]) mirror([0, 0, 1]) motor_plate();
module spacers() for (p = [[8, 8], [112, 8], [8, 65], [112, 65]])
  translate([-88 + p[0], pen_y - 36.5 + p[1], 0]) tube(12, plate_z, 5);
module y_motor() translate([-motor_off, pen_y, plate_z]) nema17(shaft = 13);
module y_pulley() translate([-motor_off, pen_y, plate_z + 2.5]) pulley_b();
module the_spindle() translate([0, pen_y, plate_z + 2]) spindle();
module y_big_pulley() translate([0, pen_y, plate_z + 2.5]) big_pulley();
module y_belt() translate([0, pen_y, plate_z + 4.5]) belt_loop(-motor_off, 6.37, 0, 19.1);

// ---------- platter ----------
module platter() translate([0, pen_y, platter_z]) cylinder(d = 200, h = 1, $fn = 160);
module paper() piece("sheet") translate([0, pen_y, platter_z + 1]) cylinder(d = 196, h = 0.3, $fn = 160);
module steel_strip() translate([-50, pen_y - 6, platter_z - 1]) cube([100, 12, 1]);
module cd() translate([0, pen_y, platter_z - 2.2]) {
  piece("disc") tube(120, 1.2, 15);
  piece("hub") difference() { tube(34, 1.25, 15); translate([0, 0, -1]) tube(30, 3, 22); }
}

// ---------- electronics (back right corner, USB toward the right edge) ----------
module electronics() translate([193.6, -62, 0]) mirror([1, 0, 0]) { uno(); drivers(); }
module power_jack() translate([185, 25, 0]) { cylinder(d = 11, h = 14); cylinder(d = 15, h = 2); }

// ---------- show ----------
module show(name) { if (part == "all" || part == name) children(); }
show("board") board();          show("bars") bars();             show("screw_holders") screw_holders();
show("stands") { stand(-1); stand(1); }                          show("spools") spools();
show("rods") rods();            show("blocks") blocks();         show("carriage_plate") carriage_plate();
show("stage") stage();          show("slider") slider();         show("pen_clip") pen_clip();
show("knob") knob();            show("pen") the_pen();
show("x_motor_plate") x_motor_plate();  show("x_motor") x_motor();  show("x_pulley") x_pulley();
show("idler_bracket") idler_bracket();  show("idler_pulley") idler_pulley();  show("x_belt") x_belt();
show("idler_axle") idler_axle();
show("rotary_plate") rotary_plate();    show("spacers") spacers();  show("y_motor") y_motor();
show("y_pulley") y_pulley();    show("spindle") the_spindle();   show("big_pulley") y_big_pulley();
show("y_belt") y_belt();
show("platter") platter();      show("paper") paper();           show("steel_strip") steel_strip();
show("cd") cd();
show("electronics") electronics();  show("power_jack") power_jack();

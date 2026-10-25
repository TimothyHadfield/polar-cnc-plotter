// The whole plotter, assembled, for the 3D build guide (build.html).
// Layout follows the Instructables "Polar CNC Plotter V2"; printed parts are Tim's (plotter-parts.scad);
// bought parts are simple stand-ins at their catalogue sizes. Positions not measured on the real
// machine are approximate.
// One part at a time: openscad -D 'part="rods"' (tools/make-build-model.py exports them all).
// World: X along the rail, Y toward the back, Z up. Board top is z = 0, platter centre is x = 0.

use <plotter-parts.scad>

part = "all";
$fn = 48;

// ---------- layout ----------
stand_x  = 150;        // stands 300 mm apart (guide)
rod_y    = 50;         // rods' plane, near the back of the board
rod_lo   = 75;         // lower rod (tee) height
rod_hi   = 137;        // upper rod (elbow) height
belt_z   = (rod_lo + rod_hi) / 2;
pulley_x = 119;        // X belt pulley centres, inward of the stands
fit_r    = 13.5;       // 1/2" PVC fitting outer radius
pipe_d   = 21.3;       // 1/2" PVC pipe outer diameter
plate_z  = 26;         // rotary plate rests on 26 mm spacers
carriage_x = 0;
block_face = rod_y - 11;            // SC8UU mounting face (rod centre is 11 mm behind it)
stage_front = block_face - 2 - 20;  // carriage plate 2 mm, linear stage 20 mm deep
pen_y    = stage_front - 14 - 23 + 8.5;  // slider 14 deep, clip 23 deep, pen 8.5 into the clip
platter_z = 40;
motor_off = 68;        // 20T to 60T centre distance for a 220 mm GT2 loop

// ---------- bought parts ----------
module nema17(shaft = 24) {         // mount face at z = 0, body below, shaft up
  translate([-21.15, -21.15, -38]) cube([42.3, 42.3, 38]);
  cylinder(d = 22, h = 2);
  cylinder(d = 5, h = shaft);
  translate([-8, 21.15, -16]) cube([16, 6, 10]);   // connector
}
module gt2_16t() {                  // aluminium pulley, bore along z, 0..16
  cylinder(d = 16, h = 1); translate([0, 0, 1]) cylinder(d = 10.2, h = 7);
  translate([0, 0, 8]) cylinder(d = 16, h = 1); translate([0, 0, 9]) cylinder(d = 13, h = 7);
}
module sc8uu() {                    // 30 along the rod (x), 34 wide (z), 22 deep (y); rod hole 11 from the face
  difference() {
    translate([-15, 0, -17]) cube([30, 22, 34]);
    translate([-16, 11, 0]) rotate([0, 90, 0]) cylinder(d = 15, h = 32);
  }
}
module belt_loop(x1, r1, x2, r2, w = 6, t = 1.4) {   // closed loop in the XY plane, z 0..w
  linear_extrude(w) difference() {
    hull() { translate([x1, 0]) circle(r1 + t); translate([x2, 0]) circle(r2 + t); }
    hull() { translate([x1, 0]) circle(r1); translate([x2, 0]) circle(r2); }
  }
}
module linear_stage() {             // QINIZX 48 mm stroke stage, 25 x 81 x 20, slider on the front
  difference() { cube([25, 20, 81]); translate([3, -1, 6]) cube([19, 12, 69]); }
  translate([12.5, 10, 6]) cylinder(d = 2.8, h = 69);
  translate([12.5, 10, 75]) cylinder(d = 15, h = 11);
}
module stage_slider() cube([25, 14, 10]);
module spindle() {                  // salvaged disc-drive spindle: stator board + rotor (z = 0 on the plate)
  translate([-20, -18, 0]) cube([46, 36, 1.2]);
  translate([0, 0, 1.2]) cylinder(d = 27.8, h = 8.3);
  cylinder(d = 10, h = 11.2);
}
module uno() {                      // Arduino Uno + CNC shield V3
  color("#1c5fa8") cube([68.6, 53.3, 1.6]);
  translate([0, 0, 13]) cube([68.6, 53.3, 1.6]);
}
module drivers() for (i = [0 : 2]) translate([8 + i * 20, 20, 14.6]) {
  cube([15, 20, 9]);
  translate([2, 4, 9]) cube([11, 11, 6]);
}
module pen() { cylinder(d = 11, h = 120); translate([0, 0, -8]) cylinder(d1 = 2, d2 = 11, h = 8); }

// ---------- stands ----------
module tube(d, h, id = 0) difference() { cylinder(d = d, h = h); if (id > 0) translate([0, 0, -1]) cylinder(d = id, h = h + 2); }
module stand(side) {                // side = +1 right, -1 left
  translate([side * stand_x, rod_y, 0]) {
    tube(2 * fit_r, 38, pipe_d);                                      // socket at the bottom
    cylinder(d = pipe_d, h = rod_hi);                                 // pipe
    translate([0, 0, rod_lo - 27]) tube(2 * fit_r, 54);               // tee
    translate([0, 0, rod_lo]) rotate([0, -side * 90, 0]) tube(2 * fit_r, 27, pipe_d);
    translate([0, 0, rod_hi - 27]) tube(2 * fit_r, 27);               // elbow
    translate([0, 0, rod_hi]) sphere(r = fit_r);
    translate([0, 0, rod_hi]) rotate([0, -side * 90, 0]) tube(2 * fit_r, 27, pipe_d);
  }
}
module screw_holders() for (s = [-1, 1]) translate([s * stand_x, rod_y, 0]) difference() {
  union() { cylinder(d = 20, h = 2); cylinder(d = 15, h = 15); }
  translate([0, 0, -1]) cylinder(d = 5, h = 17);
}
module spools() for (s = [-1, 1], z = [rod_lo, rod_hi])
  translate([s * (stand_x - 29), rod_y, z]) rotate([0, s * 90, 0]) spool();

// ---------- base ----------
module board() difference() {
  translate([-200, -65, -5]) cube([400, 130, 5]);
  translate([-motor_off - 23, pen_y - 23, -6]) cube([46, 46, 7]);   // the platter motor sits through the board
}
module bars() for (y = [-45, 45]) translate([-195, y - 7.5, -20]) cube([390, 15, 15]);

// ---------- rail + carriage ----------
module rods() for (z = [rod_lo, rod_hi]) translate([-150, rod_y, z]) rotate([0, 90, 0]) cylinder(d = 8, h = 300);
module blocks() for (x = [-15, 15], z = [rod_lo, rod_hi]) translate([carriage_x + x, block_face, z]) sc8uu();
module carriage_plate() translate([carriage_x - 28.5, block_face - 2, belt_z + 47.5 + 7.5]) rotate([-90, 0, 0]) base_plate();

// ---------- pen lift ----------
module stage() translate([carriage_x - 12.5, stage_front, 66]) linear_stage();
module slider() translate([carriage_x - 12.5, stage_front - 14, 100]) stage_slider();
module pen_clip() translate([carriage_x + 10, stage_front - 14 - 23, 100]) rotate([0, 0, 90]) clip();
module knob() translate([carriage_x, stage_front - 14 - 23, 105]) rotate([90, 0, 0]) gear();
module the_pen() translate([carriage_x, pen_y, platter_z + 9]) pen();

// ---------- X drive ----------
module x_motor_plate() translate([pulley_x - 22.23, rod_y + 8, belt_z + 41]) rotate([-90, 0, 0]) motor_plate_2();
module x_motor() translate([pulley_x, rod_y + 11, belt_z]) rotate([90, 0, 0]) nema17();
module x_pulley() translate([pulley_x, rod_y + 8, belt_z]) rotate([90, 0, 0]) gt2_16t();
module idler_bracket() translate([-stand_x + fit_r, rod_y - 9, belt_z - 17.5])
  multmatrix([[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]]) bracket();
module idler_pulley() translate([-pulley_x, rod_y + 5, belt_z]) rotate([90, 0, 0]) pulley_a();
module x_belt() translate([0, rod_y + 3, belt_z]) rotate([90, 0, 0]) belt_loop(-pulley_x, 6.37, pulley_x, 5.1);

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
module platter() translate([0, pen_y, platter_z]) cylinder(d = 200, h = 1, $fn = 120);
module paper() translate([0, pen_y, platter_z + 1]) cylinder(d = 196, h = 0.3, $fn = 120);
module steel_strip() translate([-50, pen_y - 6, platter_z - 1]) cube([100, 12, 1]);
module cd() translate([0, pen_y, platter_z - 2.2]) tube(120, 1.2, 15);

// ---------- electronics ----------
module electronics() translate([60, 3, 0]) { uno(); drivers(); }
module power_jack() translate([190, 20, 0]) { cylinder(d = 11, h = 14); cylinder(d = 15, h = 2); }

// ---------- show ----------
module show(name) { if (part == "all" || part == name) children(); }
show("board") board();          show("bars") bars();             show("screw_holders") screw_holders();
show("stands") { stand(-1); stand(1); }                          show("spools") spools();
show("rods") rods();            show("blocks") blocks();         show("carriage_plate") carriage_plate();
show("stage") stage();          show("slider") slider();         show("pen_clip") pen_clip();
show("knob") knob();            show("pen") the_pen();
show("x_motor_plate") x_motor_plate();  show("x_motor") x_motor();  show("x_pulley") x_pulley();
show("idler_bracket") idler_bracket();  show("idler_pulley") idler_pulley();  show("x_belt") x_belt();
show("rotary_plate") rotary_plate();    show("spacers") spacers();  show("y_motor") y_motor();
show("y_pulley") y_pulley();    show("spindle") the_spindle();   show("big_pulley") y_big_pulley();
show("y_belt") y_belt();
show("platter") platter();      show("paper") paper();           show("steel_strip") steel_strip();
show("cd") cd();
show("electronics") electronics();  show("power_jack") power_jack();

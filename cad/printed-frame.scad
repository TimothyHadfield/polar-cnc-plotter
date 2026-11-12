// Printed frame, prototype 1 (2026-11-11). Replaces the plywood board, PVC stands, rod spools,
// screw holders, motor_plate_2, idler bracket + nail, motor_stand and the glued platter hub.
// Tim: "scrap the wooden board at the bottom entirely, as well as maybe the PVC pipes so that
// everything is lined up perfectly ... print them in 3 separate components (each stand and the
// bottom plate), and then connect them together".
//
// Prints: frame_base (flat, 250 x 135), stand_right + stand_left (each lies on its outer face, so
// every wall grows straight up and the rod holes print vertical and round), platter_wheel (right
// side up). No supports needed. Hardware: 6 x M3x12 + nuts (stands to base), the motors' own
// M3 screws, 2 x M3 set screws + nuts (wheel), M3x25 + nut (idler), 4 x M3 screws (Arduino, optional).
//
// World: X along the rods, Y toward the back, Z up. Base top z = 0, platter centre at x = 0.
// One part: openscad -D 'part="stand_right"' ...  (part = assembly | base | stand_right |
// stand_left | wheel | print_* for the print-orientation copies).

use <plotter-parts.scad>
use <plotter-assembly.scad>

part = "assembly";
show_disc = true;      // false: the assembly without the disc, to see the wheel
$fn = 64;

// ---------- numbers to measure (assumed until Tim measures) ----------
rod_len   = 300;      // the 8 mm rods. The stands' rod holes end at +-rod_len/2
shaft_len = 24;       // platter motor shaft above its face
disc_d    = 200;      // aluminium platter disc
disc_t    = 1;
pen_y     = -11.5;    // pen line (from the carriage stack, approximate). The motor slots give +-3 mm

// ---------- platter stack ----------
motor_len = 38;  stand_gap = 0.5;
cage_top  = 6;                         // motor cage top plate (screw heads sunk 3.5 into it)
face_z    = motor_len + stand_gap;     // 38.5: motor face, hangs under the cage top
cage_z    = face_z + cage_top;         // 44.5
wheel_z0  = cage_z + 1;                // wheel bottom, 1 mm above the cage
wheel_top = face_z + shaft_len + 1;    // 63.5: the disc rests here (shaft tip 1 mm below)
plate_top = wheel_top + disc_t;        // 64.5
lift      = plate_top - 41;            // everything on the rods rises this much (old platter top: 41)
rod_y  = 50;
rod_lo = 75 + lift;
rod_hi = 137 + lift;
belt_z = (rod_lo + rod_hi) / 2;

// ---------- base ----------
base_t  = 6;
base_x  = 125;                 // base spans x -125..125 (fits a 256 mm bed)
base_y0 = -55;  base_y1 = 80;
lap_x   = 105;                 // stands' tongues lie on x 105..125
lap_low = 3;                   // base keeps its lower 3 mm under the tongue
tongue_top = 4;                // tongue's top, above the base top
bolt_x  = 115;
bolt_y  = [-42, 12, 68];
motor_w = 42.3;  motor_fit = 0.4;  cage_wall = 3;
slide   = 3;                   // motor slides +-3 mm along Y to put the shaft on the pen line
ard_x = 40;  ard_y = 76;       // Arduino: left edge, USB end (USB + 12 V jack face the back)
uno_holes = [[14, 2.5], [15.3, 50.7], [66.1, 7.6], [66.1, 35.5]];

module m3_nut_pocket(depth) cylinder(d = 6.4, h = depth, $fn = 6);
module obround(d, h, ext) hull() for (y = [-ext, ext]) translate([0, y, 0]) cylinder(d = d, h = h);

module motor_cage() {          // origin = motor axis on the base top
  in = motor_w / 2 + motor_fit;  out = in + cage_wall;  ly = out + slide;
  difference() {
    union() {
      for (s = [-1, 1]) translate([s > 0 ? in : -out, -ly, 0]) cube([cage_wall, 2 * ly, face_z]);
      translate([-out, -ly, face_z]) cube([2 * out, 2 * ly, cage_top]);
    }
    translate([0, 0, face_z - 1]) obround(23.5, cage_top + 2, slide);           // motor boss
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx * 15.5, sy * 15.5, 0]) {
      translate([0, 0, face_z - 1]) obround(3.4, cage_top + 2, slide);          // screw slots
      translate([0, 0, cage_z - 3.5]) obround(6.5, 4, slide);                   // heads sunk
    }
  }
}

module tray() {                // Arduino Uno drops in; rim on 3 sides, open at the USB end
  x0 = ard_x - 2.5;  x1 = ard_x + 53.3 + 2.5;  y0 = ard_y - 68.6 - 2.5;
  difference() {
    translate([x0, y0, 0]) cube([x1 - x0, ard_y - y0, 7]);
    translate([x0 + 2, y0 + 2, -1]) cube([x1 - x0 - 4, ard_y - y0, 9]);
  }
  for (p = uno_holes) translate([ard_x + p[1], ard_y - p[0], 0]) difference() {
    cylinder(d = 5.5, h = 4);
    translate([0, 0, 1]) cylinder(d = 2.6, h = 4, $fn = 24);
  }
}

module frame_base() difference() {
  union() {
    translate([-base_x, base_y0, -base_t]) cube([2 * base_x, base_y1 - base_y0, base_t]);
    translate([0, pen_y, 0]) motor_cage();
    tray();
  }
  for (s = [-1, 1]) translate([s > 0 ? lap_x : -base_x - 1, base_y0 - 1, -base_t + lap_low])
    cube([base_x - lap_x + 1, base_y1 - base_y0 + 2, base_t]);
  for (s = [-1, 1], y = bolt_y) translate([s * bolt_x, y, -base_t - 1]) {
    cylinder(d = 3.4, h = base_t + 2, $fn = 24);
    m3_nut_pocket(1 + 2.6);
  }
}

// ---------- stands (built as the right one; the left is its mirror with the idler) ----------
col_x0 = 148;  col_x1 = 170;           // column, measured from the centre
col_y0 = 32.5; col_y1 = 64;            // front face = the X motor's mounting face
arm_x0 = rod_len / 2 - 22;             // rod holes 22 deep
arm_h  = 22;
rod_hole = 8.2;                        // same fit as the spools (vertical holes in this print)
mx = 128;                              // X motor shaft
ix = rod_len / 2 - 30.88;              // idler axle (mirrored to the left)
cheek_t = 4;  idler_gap = 14;

module tri_x(x0, w, pts) translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(w) polygon(pts);

module stand_body() {
  translate([lap_x, base_y0, -lap_low]) cube([base_x - lap_x + 0.01, base_y1 - base_y0, lap_low + tongue_top]);
  translate([base_x, base_y0, -base_t]) cube([col_x1 - base_x, base_y1 - base_y0, base_t + tongue_top]);
  translate([col_x0, col_y0, 0]) cube([col_x1 - col_x0, col_y1 - col_y0, rod_hi + arm_h / 2]);
  for (z = [rod_lo, rod_hi]) translate([arm_x0, col_y0, z - arm_h / 2]) cube([col_x0 - arm_x0 + 0.01, col_y1 - col_y0, arm_h]);
  for (g = [[148, 6], [164, 6]]) tri_x(g[0], g[1], [[col_y0 + 0.01, tongue_top - 0.01], [-40, tongue_top - 0.01], [col_y0 + 0.01, 94]]);
  tri_x(164, 6, [[col_y1 - 0.01, tongue_top - 0.01], [base_y1, tongue_top - 0.01], [col_y1 - 0.01, 50]]);
}
module stand_holes() {
  for (z = [rod_lo, rod_hi]) translate([arm_x0 - 0.01, rod_y, z]) rotate([0, 90, 0]) {
    cylinder(d = rod_hole, h = rod_len / 2 - arm_x0, $fn = 96);
    cylinder(d1 = rod_hole + 1.2, d2 = rod_hole, h = 0.6, $fn = 96);            // lead-in
  }
  for (y = bolt_y) translate([bolt_x, y, -lap_low - 1]) cylinder(d = 3.4, h = lap_low + tongue_top + 2, $fn = 24);
}
module motor_flange() difference() {   // X motor mounts on the stand's front face
  translate([mx - motor_w / 2, col_y0, belt_z - motor_w / 2]) cube([col_x0 - (mx - motor_w / 2) + 0.01, 4, motor_w]);
  translate([mx, col_y0 - 1, belt_z]) rotate([-90, 0, 0]) {
    cylinder(d = 10, h = 6);
    translate([0, 0, 0.99]) cylinder(d = 23.5, h = 2.2);                         // boss recess
    for (sx = [-1, 1], sz = [-1, 1]) translate([sx * 15.5, sz * 15.5, 0]) cylinder(d = 3.4, h = 6, $fn = 24);
  }
}
module idler_fork() difference() {     // two cheeks; M3x25 axle, pulley_m3 + 2 idler_washers between
  for (y = [rod_y - idler_gap / 2 - cheek_t, rod_y + idler_gap / 2]) hull() {
    translate([ix, y, belt_z]) rotate([-90, 0, 0]) cylinder(r = 11, h = cheek_t);
    translate([col_x0, y, belt_z - 11]) cube([0.01, cheek_t, 22]);
  }
  translate([ix, rod_y - 20, belt_z]) rotate([-90, 0, 0]) cylinder(d = 3.4, h = 40, $fn = 24);
  translate([ix, rod_y + idler_gap / 2 + cheek_t - 2.5, belt_z]) rotate([-90, 0, 0]) m3_nut_pocket(3);
}
module stand_right() difference() { union() { stand_body(); motor_flange(); } stand_holes(); }
module stand_left() mirror([1, 0, 0]) difference() { union() { stand_body(); idler_fork(); } stand_holes(); }

// ---------- platter wheel: clamps the shaft, carries the disc on 6 spokes + a rim ring ----------
w_h  = wheel_top - wheel_z0;           // 18
grip = 0.15;                           // fingers sit this far inside the disc's edge (squeeze)
shaft_d = 5;  shaft_flat = 4.5;  bore_fit = 0.15;
nut_x = 4.0;  nut_t = 2.6;  nut_w = 5.8;
set_z = [3.5, w_h - 4.5];              // two set screws on the shaft's flat, 10 mm apart
module finger() {
  fr = disc_d / 2 - grip;
  translate([94, -6, 0]) cube([fr + 2 - 94, 12, 3]);                             // tab from the ring
  difference() {
    translate([fr, -6, 0]) cube([2, 12, w_h + disc_t]);                          // springs out 1.9 mm
    translate([fr, 0, w_h + disc_t]) rotate([0, 45, 0]) cube([0.9, 14, 0.9], center = true);   // lead-in
  }
}
module platter_wheel() {
  fx = shaft_flat + bore_fit - (shaft_d + bore_fit) / 2;
  difference() {
    union() {
      cylinder(d = 22, h = w_h);
      for (a = [30 : 60 : 330]) rotate(a) translate([0, -2.5, 0]) cube([96, 5, w_h]);
      difference() { cylinder(r = 98, h = w_h, $fn = 240); translate([0, 0, -1]) cylinder(r = 94, h = w_h + 2, $fn = 240); }
      for (a = [90, 210, 330]) rotate(a) finger();
    }
    translate([0, 0, -1]) intersection() {                                       // D bore
      cylinder(d = shaft_d + bore_fit, h = w_h + 2);
      translate([-shaft_d, -shaft_d, 0]) cube([shaft_d + fx, 2 * shaft_d, w_h + 2]);
    }
    for (z = set_z) translate([0, 0, z]) rotate([0, 90, 0]) cylinder(d = 3.2, h = 100, $fn = 24);   // also the key hole in the ring
    translate([nut_x, -nut_w / 2, -1]) cube([nut_t, nut_w, set_z[0] + 1 + 3.25]);
    translate([nut_x, -nut_w / 2, set_z[1] - 3.25]) cube([nut_t, nut_w, 10]);
  }
}

// ---------- assembly (bought parts from plotter-assembly.scad) ----------
c_print = "#e07a35";  c_wheel = "#2f8fb3";  c_metal = "#b9c0c6";  c_dark = "#4a4f55";
module assembly() {
  color(c_print) frame_base();
  color(c_print) stand_right();
  color(c_print) stand_left();
  color(c_wheel) translate([0, pen_y, wheel_z0]) platter_wheel();
  if (show_disc) {
    color(c_metal) translate([0, pen_y, wheel_top]) cylinder(d = disc_d, h = disc_t, $fn = 160);
    color("white") translate([0, pen_y, plate_top]) cylinder(d = disc_d - 4, h = 0.3, $fn = 160);
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
  color("#2a6db0") translate([ard_x, ard_y, 4]) rotate(-90) { uno(); drivers(); }
}

// print orientation copies
module print_stand_right() translate([0, 0, col_x1]) rotate([0, 90, 0]) stand_right();
module print_stand_left()  translate([0, 0, col_x1]) rotate([0, -90, 0]) stand_left();

module exploded() {            // the three frame prints pulled apart, wheel above its cage
  color(c_print) frame_base();
  color(c_print) translate([45, 0, 25]) stand_right();
  color(c_print) translate([-45, 0, 25]) stand_left();
  color(c_wheel) translate([0, pen_y, wheel_z0 + 45]) platter_wheel();
}
if (part == "assembly")    assembly();
if (part == "exploded")    exploded();
if (part == "base")        frame_base();
if (part == "stand_right") stand_right();
if (part == "stand_left")  stand_left();
if (part == "wheel")       platter_wheel();
if (part == "print_stand_right") print_stand_right();
if (part == "print_stand_left")  print_stand_left();

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
// Assembly order: rods (with the bearing blocks on) into both stands -> slide the stands + rods
// onto the base's two rails from the front, together, until they stop -> platter motor slides
// into its cage from the front, 4 screws from the top -> wheel onto the shaft, 2 set screws ->
// disc into the wheel's lip, paper on top, clamp ring snapped over -> Uno pressed onto its pegs.
//
// Prints: frame_base (flat), stand_right + stand_left (each lies on its outer face, so every wall
// grows straight up and the rod holes print vertical and round), platter_wheel (right side up),
// clamp_ring (top face down). No supports.
// World: X along the rods, Y toward the back, Z up. Base top z = 0, platter centre at x = 0.
// One part: openscad -D 'part="stand_right"' ...

use <plotter-parts.scad>
use <plotter-assembly.scad>

part = "assembly";
show_disc = true;      // false: the assembly without disc, paper and clamp ring
$fn = 64;

// ---------- numbers to measure (assumed until Tim measures) ----------
rod_len   = 300;      // the 8 mm rods. Rod holes end 0.5 mm past +-rod_len/2
shaft_len = 24;       // platter motor shaft above its face
disc_d    = 200;      // aluminium platter disc
disc_t    = 1;
// Pen line (Tim 11-11: "make sure it's all aligned perfectly"). Front-to-back chain from the rods:
//   rod centre -> SC8UU mounting face (sc8uu_h) -> carriage plate back face -> pen centre (carriage_d).
// carriage_d from the CAD of Tim's parts: plate 2 + 1 (stage face pad) - 1.5 (stage pocket) = 1.5,
// stage 20 (listing), slider 14 (listing; how far it stands proud of the stage is NOT known),
// clip 23 with the pen 8.5 in (how the clip mounts on the new slider is NOT known) -> 50.0.
// MEASURE on the real carriage and put the number here; it moves the motor cage (the stop).
rod_y      = 50;      // rods' plane (stands and frame are built around it)
sc8uu_h    = 11;     // SC8UU spec: rod centre to mounting face. Measure: block depth / 2 (22 / 2)
carriage_d = 50.0;    // carriage plate back face (bearing side) to the pen's centre line. MEASURE
pen_y      = rod_y - sc8uu_h - carriage_d;   // = -11.0 (was -11.5: the stage pocket was missed)

// ---------- platter stack ----------
motor_len = 38;  stand_gap = 0.5;
cage_top  = 6;
face_z    = motor_len + stand_gap;     // 38.5: motor face, under the cage top
cage_z    = face_z + cage_top;         // 44.5
wheel_z0  = cage_z + 1;
wheel_top = face_z + shaft_len + 1;    // 63.5: the disc rests here
plate_top = wheel_top + disc_t;        // 64.5
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
dt_fit = 0.2;                  // clearance per face
dt_stop = 5;                   // rail ends this far before the back edge = the stop
motor_w = 42.3;  motor_fit = 0.4;  cage_wall = 3;
slide   = 3;
stop_w  = 6;                   // back-stop rib width (motor plug passes between the ribs)
ard_x = 40;  ard_y = 76;       // Uno: left edge, USB end (USB + 12 V jack face the back)
uno_holes = [[14, 2.5], [15.3, 50.7], [66.1, 7.6], [66.1, 35.5]];
uno_pad = 3;                   // board sits 3 mm up (its solder pins clear)

module obround(d, h, ext) hull() for (y = [-ext, ext]) translate([0, y, 0]) cylinder(d = d, h = h);
module dt_profile(c = 0) polygon([[dt_x - dt_wb / 2 - c, -dt_h - 0.01], [dt_x + dt_wb / 2 + c, -dt_h - 0.01],
                                  [dt_x + dt_wt / 2 + c, c], [dt_x - dt_wt / 2 - c, c]]);
module along_y(y0, y1) translate([0, y1, 0]) rotate([90, 0, 0]) linear_extrude(y1 - y0) children();

module motor_cage() {          // origin = motor axis on the base top
  in = motor_w / 2 + motor_fit;  out = in + cage_wall;  ly = out + slide;
  difference() {
    union() {
      for (s = [-1, 1]) translate([s > 0 ? in : -out, -ly, 0]) cube([cage_wall, 2 * ly, face_z]);
      translate([-out, -ly, face_z]) cube([2 * out, 2 * ly, cage_top]);
      // back stop (Tim 11-11: "push it in ... until it hits the edge and it's in the perfect
      // position"): two ribs at the back corners stop the motor with its shaft exactly on the
      // design centre. The middle stays open for the motor's plug.
      // ribs start at the motor's half-width (not the side walls' clearance), so the shaft is exactly
      // on the centre when the motor touches them
      for (s = [-1, 1]) translate([s > 0 ? in - stop_w : -in, motor_w / 2, 0]) cube([stop_w, ly - motor_w / 2, face_z]);
    }
    // boss + shaft slot, open to the front: the motor slides in from the front with its shaft up
    translate([-11.75, -ly - 1, face_z - 1]) cube([23.5, ly + 1 + slide, cage_top + 2]);
    translate([0, 0, face_z - 1]) obround(23.5, cage_top + 2, slide);
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx * 15.5, sy * 15.5, 0]) {
      translate([0, 0, face_z - 1]) obround(3.4, cage_top + 2, slide);          // screw slots
      translate([0, 0, cage_z - 3.5]) obround(6.5, 4, slide);                   // heads sunk
    }
  }
}

// Uno slides in (Tim 11-11: "an indent or something where it can fit nicely ... a little overhang
// so that we can slide the arduino in"): a snug pocket open at the back (USB end), two overhanging
// lips along the long sides, and the closed front wall is the stop. No pegs, no screws.
// Lips cover 0.5 mm of board edge; the Uno's headers start ~1.2 mm in from its long edges.
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
  for (p = uno_holes) translate([ard_x + p[1], ard_y - p[0], 0]) cylinder(d = 5.5, h = uno_pad);  // pads
}

module frame_base() difference() {
  union() {
    translate([-lap_x, base_y0, -base_t]) cube([2 * lap_x, base_y1 - base_y0, base_t]);
    for (s = [-1, 1]) mirror([s < 0 ? 1 : 0, 0, 0]) {
      translate([lap_x - 0.01, base_y0, -base_t]) cube([base_x - lap_x + 0.01, base_y1 - base_y0, lap_low]);
      along_y(base_y0, base_y1 - dt_stop) dt_profile();                         // the rail
    }
    translate([0, pen_y, 0]) motor_cage();
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
ix = rod_len / 2 - 30.88;
cheek_t = 4;  idler_gap = 14;

module tri_x(x0, w, pts) translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(w) polygon(pts);
module m3_nut_pocket(depth) cylinder(d = 6.4, h = depth, $fn = 6);

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
    cylinder(d = rod_hole, h = rod_len / 2 - arm_x0 + 0.5, $fn = 96);
    cylinder(d1 = rod_hole + 1.2, d2 = rod_hole, h = 0.6, $fn = 96);
  }
  along_y(base_y0 - 1, base_y1 - dt_stop) dt_profile(dt_fit);   // end flush with the rail end: rods land exactly on rod_y         // groove, closed at the back
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
  translate([ix, rod_y - 20, belt_z]) rotate([-90, 0, 0]) cylinder(d = 3.4, h = 40, $fn = 24);
  translate([ix, rod_y + idler_gap / 2 + cheek_t - 2.5, belt_z]) rotate([-90, 0, 0]) m3_nut_pocket(3);
}
module stand_right() difference() { union() { stand_body(); motor_flange(); } stand_holes(); }
module stand_left() mirror([1, 0, 0]) difference() { union() { stand_body(); idler_fork(); } stand_holes(); }

// ---------- platter wheel ----------
w_h  = wheel_top - wheel_z0;           // 18
ring_in = 96;  ring_out = 101.5;
lip_in  = disc_d / 2 + 0.15;           // the disc drops into this lip: centred to 0.15 mm
lip_h   = disc_t - 0.2;                // lip stays 0.2 below the disc top, so the clamp presses the disc
bead_out = 102.5;  bead_z = w_h - 6;   // catch for the clamp ring's hooks (flat underside)
shaft_d = 5;  shaft_flat = 4.5;  bore_fit = 0.15;
nut_x = 4.0;  nut_t = 2.6;  nut_w = 5.8;
set_z = [3.5, w_h - 4.5];
// Tim 11-11: the disc was only held by friction. Default now: the platter face is PART OF THE
// WHEEL (a solid top skin, printed face-down on the bed so it comes out flat). Paper is pinched
// between that face and the clamp ring, and the ring's hooks sit between ribs on the wheel, so
// nothing can slip. platter = "disc" brings back the aluminium-disc version (lip + friction).
platter = "printed";
top_t   = 2;                           // printed platter skin; its top is where the disc top was
hook_ang = [0, 90, 180, 270];          // clamp ring hooks (16 degrees wide each)
// Soft pad under the paper (Tim 11-11: vinyl "so that the pen can push slightly further"). It lies
// on the flat face, cut to the platter's size, and the clamp ring pinches pad + paper together, so
// the hooks are pad_t longer. (A pocket for it was tried and dropped: the face prints on the bed,
// so a pocket's floor would print in mid-air.) MEASURE Tim's sheet; 0 = no pad.
pad_t   = 1;
module platter_wheel() {
  fx = shaft_flat + bore_fit - (shaft_d + bore_fit) / 2;
  difference() {
    union() {
      cylinder(d = 22, h = w_h);
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
    // the bore stops under the platter face (shaft tip is 1 mm below the old disc seat)
    cap = platter == "disc" ? w_h + 1 : w_h + disc_t - top_t;
    translate([0, 0, -1]) intersection() {
      cylinder(d = shaft_d + bore_fit, h = cap + 1);
      translate([-shaft_d, -shaft_d, 0]) cube([shaft_d + fx, 2 * shaft_d, cap + 1]);
    }
    for (z = set_z) translate([0, 0, z]) rotate([0, 90, 0]) cylinder(d = 3.2, h = 110, $fn = 24);
    translate([nut_x, -nut_w / 2, -1]) cube([nut_t, nut_w, set_z[0] + 1 + 3.25]);
    translate([nut_x, -nut_w / 2, set_z[1] - 3.25]) cube([nut_t, nut_w, cap - set_z[1] + 3.25]);
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
  translate([70, -30, -5]) cube([40, 60, 50]);
  union() {
    color(c_wheel) platter_wheel();
    color("#1f5f7a") translate([0, 0, w_h + disc_t + 12]) clamp_ring();
  }
}
// motor going into its cage from the front
module cage_demo() {
  color(c_print) intersection() { frame_base(); translate([-60, -80, -10]) cube([120, 110, 70]); }
  color(c_dark) translate([0, pen_y - 55, face_z]) nema17();
  color("#2f8fb3") translate([0, pen_y - 30, face_z + 30]) rotate([90, 0, 0]) linear_extrude(1) text("slides in", size = 7, halign = "center");
}

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

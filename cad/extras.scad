// Extras (upgrades wave, 2026-11-15): homing switch mount + board cover. docs/upgrades-plan.md #4, #5.
// Tim: "adjust our current 3D print designs in order to fit with them ... consider that the multiple
// adjustments might adjust the design of multiple different prints that have nothing to do with
// them, and also will need to work together with the space that they have." Neither part changes an
// existing print: the switch mount clips onto the top rod, the cover clips onto the base's Uno pocket.
// PLA, no supports, no screws, no tape. World frame = printed-frame.scad's assembly.
// One part: openscad -D 'part="switch_mount"' cad/extras.scad
//
// HOMING SWITCH (carriage axis only, motor side = world +x = machine X-)
// Where: on the TOP rod between the upper bearing block and the right stand's arm, with the switch
// BEHIND the block (y > 61), not in its path. The block's back face slides under the lever like a
// cam: the lever's tip leans 2.3 mm into the block's path, the block's back corner pushes it in
// sideways, and from then on the lever just rides on the block's flat back face. So the carriage can
// run on to its hard stop (c 78.35, plate meets the motor flange) without crushing the switch: the
// lever is never pressed past sw_ride, whatever the carriage does. (Head-on, a lever in front of the
// block would have ~1 mm of overtravel against the 4 mm between the click and the stop.)
// Why the top rod: the 20 mm between the block's end at the stop (x 108) and the arm (x 128) only has
// to hold the clip (x 112..122); the switch itself sits behind the block's path, where nothing else
// moves, and its wires are 15 mm from the right column's back-face clips (x 156, y 69.5, z 145).
// The lower rod would work the same way but puts the wires 60 mm lower and near the belt.
// Adjust: slide the clip along the rod (where it clicks), turn it on the rod (how hard the lever is
// pressed: the lever sits 7 mm above the rod, so 10 degrees moves it 1.2 mm toward/away from the block).
//
// BOARD COVER (over the Uno + CNC shield + drivers in the base's Uno pocket; base NOT changed)
// Lowered on from above (lift the wheel off first: it is 4.5 mm above the cover). Its inner ledges sit
// on the pocket's 3 wall tops, its skirts hang outside the walls, and 4 sprung tongues press a small
// bump against the walls' outer faces. The pocket walls have no undercut to snap under (the board
// fills the inside), so it is a spring grip, not a click. Back open (USB, DC jack, 12 V terminal).
// Cable slots are open at the bottom, so the cover goes on over cables that are already plugged in.

include <printed-frame.scad>

part = "extras_assembly";
carriage_c = 74;          // carriage centre (world x) for the pictures

// ---------- ASSUMED sizes of bought parts (I7) ----------
sw_l       = 20;     // ASSUMED, measure: switch body length (KW11-3Z type)
sw_h       = 10;     // ASSUMED, measure: body height, lever face to terminal face
sw_t       = 6.4;    // ASSUMED, measure: body thickness (the holes go through this way)
sw_hole_d  = 2.3;    // ASSUMED, measure: mounting holes
sw_pitch   = 9.5;    // ASSUMED, measure: hole centre to hole centre (centred along the body)
sw_hole_y  = 7.1;    // ASSUMED, measure: lever face to the holes' centres (= 2.9 from the terminal face)
sw_lever_l = 16;     // ASSUMED, measure: lever hinge to tip, along the body
sw_lever_in = 1.5;   // ASSUMED: the hinge is this far in from the body's end
sw_lever_w = 4;      // ASSUMED: lever width
sw_free    = 5.0;    // ASSUMED, measure: lever tip height above the lever face, untouched
sw_op      = 3.5;    // ASSUMED, measure: ... where it clicks
sw_bottom  = 2.0;    // ASSUMED, measure: ... pressed as far as it goes
blk_back   = 11;     // ASSUMED, measure: SC8UU rod centre to its back face (22 deep: 11 + 11)
blk_half   = 30;     // the two upper blocks (30 long each) end 30 mm from the carriage centre
rod_d      = 8;      // the rods (nominal)
// board cover: heights from the model (plotter-assembly.scad uno()/drivers(), from Tim's photos)
hs_top     = uno_pad + 13 + 8.5 + 1.6 + 2 + 7;   // 35.1 heatsink tops. ASSUMED, measure: shield top
                     // to heatsink top must stay under 23.5 (model 19.1)
plug_top   = uno_pad + 13 + 2.5 + 14;            // 32.5 motor plug tops. ASSUMED (Dupont housings 14 tall)

// ---------- switch placement ----------
c_trig = 74;                                   // carriage centre where it clicks
c_stop = mx - motor_w / 2 - 28.5;              // 78.35: carriage plate meets the X motor flange
blk_y  = rod_y + blk_back;                     // 61: the blocks' back face
sw_ride = 2.7;                                 // lever tip height while it rides on the block
sw_y   = blk_y + sw_ride;                      // 63.7: the switch's lever face
sw_dz  = 7;                                    // lever this far above the rod (turn the clip = depth)
sw_z   = rod_hi + sw_dz;                       // 168.5: middle of the switch's thickness
u_trig = sw_ride * sw_lever_l / sw_op;         // hinge to the block's corner when it clicks
sw_x   = c_trig + blk_half - u_trig - sw_lever_in;   // 90.2: the body's -x end (hinge end)
assert(sw_bottom < sw_ride && sw_ride < sw_op && sw_op < sw_free, "lever heights out of order");
assert(abs(sw_dz) + sw_lever_w / 2 + 1 <= 12, "lever off the block's flat back face");
// rod clip
rc_id   = 8.1;      // set from the fit-test coupon (7.9 / 8.1 / 8.3)
rc_open = 6.8;      // mouth (snaps over the 8 mm rod)
rc_wall = 2.4;
rc_ro   = rc_id / 2 + rc_wall;
rc_x0   = 112;  rc_len = 10;
pl_t  = 3;
pl_z0 = sw_z + sw_t / 2;                        // 171.7: plate underside = the switch's top
pl_z1 = pl_z0 + pl_t;                           // 174.7
pl_x0 = sw_x - 0.3 - 1.2 - 0.3;                 // behind the latch
assert(rc_x0 >= c_stop + blk_half + 3, "clip within 3 mm of the block at the hard stop");
assert(rc_x0 + rc_len <= arm_x0 - 4, "clip too close to the arm");
assert(pl_z1 <= 180, "mount above the I2 height limit");
assert(sw_x + sw_l < rc_x0 - 0.5, "switch runs into the clip");

module switch_body(lever = true) {             // origin: hinge end, lever face, middle of the thickness
  color("#222") difference() {
    translate([0, 0, -sw_t / 2]) cube([sw_l, sw_h, sw_t]);
    for (s = [-1, 1]) translate([sw_l / 2 + s * sw_pitch / 2, sw_hole_y, -sw_t]) cylinder(d = sw_hole_d, h = 2 * sw_t, $fn = 16);
  }
  color("#c0c0c0") for (x = [1.2, sw_l / 2 - 1.6, sw_l - 4.4]) translate([x, sw_h, -0.25]) cube([3.2, 3.5, 0.5]);   // terminals
  if (lever) color("#d8d8d8") hull() {
    translate([sw_lever_in, -0.3, -sw_lever_w / 2]) cube([0.5, 0.3, sw_lever_w]);
    translate([sw_lever_in + sw_lever_l, -sw_free, -sw_lever_w / 2]) cube([0.5, 0.3, sw_lever_w]);
  }
}
module placed_switch(lever = true) translate([sw_x, sw_y, sw_z]) switch_body(lever);

// clip profile in the y-z plane (2D x = world y, 2D y = world z), mouth down
module rc_profile(id = rc_id) {
  ro = id / 2 + rc_wall;
  nw = 3;                                      // neck half width
  difference() {
    union() {
      // teardrop: rigid over the top 90 degrees, sides at 45 degrees (they print upside down)
      hull() { translate([rod_y, rod_hi]) circle(r = ro, $fn = 64); translate([rod_y, rod_hi + ro * sqrt(2) - 0.01]) square([0.02, 0.02], center = true); }
      translate([rod_y - nw, rod_hi + ro * sqrt(2) - nw - 0.5]) square([2 * nw, pl_z1 - (rod_hi + ro * sqrt(2) - nw - 0.5)]);
    }
    translate([rod_y, rod_hi]) circle(d = id, $fn = 64);
    translate([rod_y - rc_open / 2, rod_hi - ro - 1]) square([rc_open, ro + 1]);
    // lead-in: the mouth flares to 9.6 so pushing it down onto the rod spreads the jaws
    jt = rod_hi - sqrt(pow(id / 2, 2) - pow(rc_open / 2, 2));
    polygon([[rod_y - rc_open / 2, jt], [rod_y + rc_open / 2, jt], [rod_y + 4.8, rod_hi - ro - 0.01], [rod_y - 4.8, rod_hi - ro - 0.01]]);
  }
}
module switch_mount() {
  lt_t = 1.2;  lip = 0.7;  lip_h = 1.0;
  difference() {
    union() {
      // top plate: over the switch (behind the block's path), then forward to the clip past x 111
      translate([pl_x0, sw_y - 1.2, pl_z0]) cube([rc_x0 - 1 - pl_x0, sw_h + 2.4, pl_t]);
      translate([rc_x0 - 1, rod_y - 3, pl_z0]) cube([rc_len + 2, 80 - (rod_y - 3), pl_t]);
      // rod clip
      translate([rc_x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(rc_len) rc_profile();
      // pegs through the switch's holes (tips 0.4 short, chamfered)
      for (s = [-1, 1]) translate([sw_x + sw_l / 2 + s * sw_pitch / 2, sw_y + sw_hole_y, 0]) {
        translate([0, 0, sw_z - sw_t / 2 + 0.8]) cylinder(d = sw_hole_d - 0.2, h = pl_z0 - (sw_z - sw_t / 2 + 0.8) + 0.01, $fn = 24);
        translate([0, 0, sw_z - sw_t / 2 + 0.4]) cylinder(d1 = sw_hole_d - 1.0, d2 = sw_hole_d - 0.2, h = 0.4, $fn = 24);
      }
      // latch at the hinge end: hooks under the switch (lead-in below), away from the lever face
      lz = sw_z - sw_t / 2 - 0.1;                  // the latch's catch face
      translate([sw_x - 0.3 - lt_t, sw_y + 3.5, lz - lip_h]) cube([lt_t, 5, pl_z0 - (lz - lip_h) + 0.01]);
      translate([0, sw_y + 8.5, 0]) rotate([90, 0, 0]) linear_extrude(5)      // 2D (x, z), y sw_y+3.5..8.5
        polygon([[sw_x - 0.31, lz], [sw_x + lip, lz], [sw_x + lip, lz - 0.3], [sw_x - 0.31, lz - lip_h]]);
      // wire channel for the switch's 2 wires, toward the column's back-face clips (x 156, y 69.5)
      translate([rc_x0 - 1, 75.5, pl_z0 - 6]) cube([rc_len + 2, 4.5, 6.01]);
    }
    translate([rc_x0 - 2, 76.3, pl_z0 - 7]) cube([rc_len + 4, 2.9, 6]);            // groove, open downward
    translate([rc_x0 - 2, rod_y, rod_hi]) rotate([0, 90, 0]) cylinder(d = rc_id, h = rc_len + 4, $fn = 64);
  }
  // mouth of the wire groove narrowed to 2.2 (wires push in, stay in)
  for (y = [76.3, 79.2 - 0.35]) translate([rc_x0 - 1, y, pl_z0 - 6]) cube([rc_len + 2, 0.35, 0.8]);
}
module print_switch_mount() translate([0, 0, pl_z1]) rotate([180, 0, 0]) switch_mount();   // plate on the bed

// ---------- board cover ----------
bc_wx0 = ard_x - uno_fit - uno_wall;            // 37.7  pocket walls' outer faces
bc_wx1 = ard_x + uno_w + uno_fit + uno_wall;    // 95.64
bc_wy0 = ard_y - uno_l - uno_fit - uno_wall;    // 5.12
bc_wy1 = ard_y;                                 // 76 (open end)
bc_wtop = uno_pad + 1.6 + 0.2 + lip_t;          // 6.0  wall tops
bc_gap = 0.2;  bc_skin = 1.6;  bc_top_t = 2;
bc_ceil = 40;  bc_top = bc_ceil + bc_top_t;     // 42
bc_bot = 0.3;                                   // skirt bottom, off the base top
bc_x0 = bc_wx0 - bc_gap - bc_skin;  bc_x1 = bc_wx1 + bc_gap + bc_skin;
bc_y0 = bc_wy0 - bc_gap - bc_skin;  bc_y1 = bc_wy1;
assert(bc_top <= wheel_z0 - 2, "cover within 2 mm of the wheel");
assert(bc_ceil >= hs_top + 3 && bc_ceil >= plug_top + 5, "cover too low over the drivers / plugs");
// cable slots: [side (-1 left, +1 right), y0, y1, top z]
bc_slots = [[1, 8, 17, 26],        // X motor cable: from the foot channel's end (x 102, y -1.5)
            [1, 64.5, bc_y1 + 1, 26],  // back run: pen motor + switch, from the foot channel (x 102, y 69.5)
            [-1, 43, 52, 26]];     // platter motor: from the cage's back (x 0, y ~48)
bc_tongues = [[-1, 14, 26], [-1, 58, 70], [1, 22, 34], [1, 48, 60]];
tg_h = 14;  tg_bump = 0.4;
// drivers (plotter-assembly.scad drv: Z, X, Y) in world: x 40 + uno y, y 76 - uno x
bc_drv = [[11, 9.6], [11, 35.3], [35.5, 35.3]];
function drv_box(d) = [ard_x + d[1], ard_y - d[0] - 20.3, ard_x + d[1] + 15.24, ard_y - d[0]];
module bc_side_x(s) translate([s < 0 ? bc_x0 : bc_wx1 + bc_gap, 0, 0]) children();
module board_cover() {
  ledge = 2.1;
  difference() {
    union() {
      translate([bc_x0, bc_y0, bc_ceil]) cube([bc_x1 - bc_x0, bc_y1 - bc_y0, bc_top_t]);                 // top
      for (s = [-1, 1]) bc_side_x(s) translate([0, bc_y0, bc_bot]) cube([bc_skin, bc_y1 - bc_y0, bc_top - bc_bot]);
      translate([bc_x0, bc_y0, bc_bot]) cube([bc_x1 - bc_x0, bc_skin, bc_top - bc_bot]);                  // front
      // ledges resting on the 3 wall tops (45 degree undersides: they print upside down)
      for (s = [-1, 1]) translate([s < 0 ? bc_x0 + bc_skin - 0.01 : bc_wx1 + bc_gap + 0.01, bc_y0, 0])
        mirror([s < 0 ? 0 : 1, 0, 0]) translate([0, 0, 0]) rotate([90, 0, 0]) mirror([0, 0, 1]) linear_extrude(bc_y1 - bc_y0)
          polygon([[0, bc_wtop + 0.05], [ledge, bc_wtop + 0.05], [ledge, bc_wtop + 1.05], [0, bc_wtop + 1.05 + ledge]]);
      translate([bc_x0, bc_y0 + bc_skin - 0.01, 0]) rotate([90, 0, 90]) linear_extrude(bc_x1 - bc_x0)
        polygon([[0, bc_wtop + 0.05], [ledge, bc_wtop + 0.05], [ledge, bc_wtop + 1.05], [0, bc_wtop + 1.05 + ledge]]);
      // bumps on the tongues
      for (t = bc_tongues) translate([t[0] < 0 ? bc_x0 + bc_skin - 0.01 : bc_wx1 + bc_gap + 0.01, t[1], 0])
        mirror([t[0] < 0 ? 0 : 1, 0, 0]) rotate([90, 0, 0]) mirror([0, 0, 1]) linear_extrude(t[2] - t[1])
          polygon([[0, bc_bot + 0.3], [tg_bump + 0.01, bc_bot + 1.0], [tg_bump + 0.01, bc_bot + 3.0], [0, bc_bot + 4.2]]);
    }
    // cable slots, open at the bottom
    for (sl = bc_slots) translate([sl[0] < 0 ? bc_x0 - 1 : bc_wx1 - 3, sl[1], -1]) cube([bc_skin + bc_gap + 4.5, sl[2] - sl[1], sl[3] + 1]);
    // tongues: slits either side, ledge cut away over them
    for (t = bc_tongues) {
      for (y = [t[1] - 1, t[2]]) translate([t[0] < 0 ? bc_x0 - 1 : bc_wx1 - 3, y, -1]) cube([bc_skin + bc_gap + 4.5, 1, tg_h + 1]);
      translate([t[0] < 0 ? bc_x0 + bc_skin + 0.02 : bc_wx1 - 2.2, t[1] - 1, 5]) cube([2.4, t[2] - t[1] + 2, tg_h - 5]);   // ledge (not the bump)
    }
    // vents over the 3 drivers: 2 mm slots, 3.5 mm apart, along x like the heatsink fins
    for (d = bc_drv) let(b = drv_box(d))
      for (y = [b[1] + 1.5 : 3.5 : b[3] - 3.5]) translate([b[0] + 1.5, y, bc_ceil - 1]) cube([b[2] - b[0] - 3, 2, bc_top_t + 2]);
  }
}
module print_board_cover() translate([0, 0, bc_top]) rotate([180, 0, 0]) board_cover();   // top on the bed

// ---------- fit-test coupons (I7), each well under 15 min ----------
module coupon_rod_clips() for (i = [0 : 2]) translate([i * 18, 0, 0]) difference() {   // printed as in the mount
  translate([0, 0, pl_z1]) rotate([180, 0, 0]) translate([0, -rod_y, 0]) rotate([90, 0, 90]) linear_extrude(6) {
    rc_profile([7.9, 8.1, 8.3][i]);
    translate([rod_y - 7, pl_z0]) square([14, pl_t]);                                  // foot
  }
  for (k = [0 : i]) translate([1.2, -5 + k * 2.6, -1]) cylinder(d = 1.4, h = 2, $fn = 12);  // 1, 2, 3 dots under = 7.9, 8.1, 8.3
}
module coupon_switch() translate([0, 0, pl_z1]) rotate([180, 0, 0])                      // the switch holder alone
  intersection() { switch_mount(); translate([pl_x0 - 1, sw_y - 2, sw_z - 10]) cube([rc_x0 - 1.5 - pl_x0 + 1, sw_h + 4, 20]); }
module coupon_cover() translate([0, 0, 16]) rotate([180, 0, 0]) {                         // a left-side tongue, try it on the real pocket wall
  intersection() { board_cover(); translate([bc_x0 - 1, 11, 0]) cube([bc_skin + bc_gap + 4, 18, 16]); }
  translate([bc_x0 - 6, 11, 14]) cube([bc_wx0 + 1.8 - (bc_x0 - 6), 18, 2]);              // handle / bed face
}

// ---------- pictures and clash checks ----------
module carriage_at(c) translate([c, 0, lift]) { blocks(); carriage_plate(); stage(); slider(); pen_clip(); knob(); }
module x_motor_at() translate([mx, col_y0, belt_z]) rotate([-90, 0, 0]) nema17();
module electronics_at() translate([ard_x, ard_y, uno_pad]) rotate(-90) { uno(); drivers(); }
module wheel_at() translate([0, pen_y, wheel_z0]) { platter_wheel(); shaft_collar(); }
module extras_assembly() {
  assembly();
  color("#3a9d5d") switch_mount();
  placed_switch();
  color("#3a9d5d", 0.85) board_cover();
}
module tray_zone() translate([-200, 44, 181]) cube([400, 32, 60]);
module i4_strip() translate([120, -8, 4]) cube([16, 13, 106]);

chk_c = 74;
if (part == "extras_assembly") extras_assembly();
if (part == "switch_mount")    switch_mount();
if (part == "print_switch_mount") print_switch_mount();
if (part == "board_cover")     board_cover();
if (part == "print_board_cover") print_board_cover();
if (part == "coupon_rod_clips") coupon_rod_clips();
if (part == "coupon_switch")   coupon_switch();
if (part == "coupon_cover")    coupon_cover();
if (part == "switch_area") {   // picture: the switch, block and arm near the motor
  color("#3a9d5d") switch_mount(); placed_switch();
  color(c_metal) carriage_at(carriage_c);
  color(c_print) intersection() { stand_right(); translate([100, -20, 100]) cube([80, 120, 100]); }
  color(c_dark) x_motor_at();
  color(c_metal) for (z = [rod_lo, rod_hi]) translate([-rod_len / 2, rod_y, z]) rotate([0, 90, 0]) cylinder(d = 8, h = rod_len);
}
if (part == "cover_area") {
  color(c_print) frame_base(); color("#2a6db0") electronics_at();
  color("#3a9d5d", 0.8) board_cover();
  color(c_print) intersection() { stand_right(); translate([95, -60, -10]) cube([80, 150, 60]); }
}
// clash checks: each renders the overlap (empty = no clash)
if (part == "chk_mount_carriage") intersection() { union() { switch_mount(); placed_switch(false); } carriage_at(chk_c); }
if (part == "chk_lever_carriage") intersection() { placed_switch(true); carriage_at(chk_c); }
if (part == "chk_mount_stand")    intersection() { union() { switch_mount(); placed_switch(false); } stand_right(); }
if (part == "chk_mount_rod")      intersection() { switch_mount(); translate([-rod_len / 2, rod_y, rod_hi]) rotate([0, 90, 0]) cylinder(d = rod_d, h = rod_len, $fn = 64); }
if (part == "chk_mount_motor")    intersection() { union() { switch_mount(); placed_switch(); } union() { x_motor_at(); translate([0, 0, lift]) { x_pulley(); x_belt(); } } }
if (part == "chk_mount_zones")    intersection() { union() { switch_mount(); placed_switch(); } union() { tray_zone(); i4_strip(); } }
if (part == "chk_cover_base")     intersection() { board_cover(); frame_base(); }
if (part == "chk_cover_uno")      intersection() { board_cover(); electronics_at(); }
if (part == "chk_cover_wheel")    intersection() { board_cover(); translate([0, 0, -chk_dz]) wheel_at(); }
if (part == "chk_cover_stand")    intersection() { board_cover(); stand_right(); }
chk_dz = 0;

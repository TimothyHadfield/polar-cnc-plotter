// Cable chain over the top (upgrade 1, 2026-11-15). Tim, approving the idea: "okay I see the idea
// of the cable chain now and I like it." A bendy track of small printed links that the pen motor's
// wires ride inside. It rides OVER THE TOP of the frame, never under the carriage:
// - a printed tray (two halves, joined toolless in the middle) spans the two stand tops; its
//   diamond pegs drop into the stands-3 column-top pockets (printed-frame.scad, tray_sockets);
// - one chain end (fixed end) clips into the tray a little right of the middle; the other end
//   (moving end) is a bracket whose 8 x 8 stem plugs into the carriage's socket (interface I1);
// - the chain's lower run lies in the tray, the loop rolls over toward the motor side (+x) and
//   the upper run comes back over the top to the moving end, so it rolls over itself above
//   everything as the carriage slides;
// - from the fixed end the wires cross into the gutter along the tray's back, run to the right
//   stand (motor side) and drop at x 156, y 69.5 down the column's back-face clips (I3).
// All PLA, no supports, no screws, no tape. World frame = printed-frame.scad assembly.
// One part: openscad -D 'part="chain_link"' cable-chain.scad   (parts listed at the bottom)
// Carriage position for the assembly view: -D chain_c=-95 (idler end) .. 78 (motor end).

include <printed-frame.scad>

part   = "chain_assembly";
chain_c = 0;            // carriage centre (world x) for the assembly view

// ---------- ASSUMED sizes (I7) ----------
cable_d   = 4.5;        // ASSUMED, measure: the pen (linear) motor's 4-wire bundle / cable, 4-5 mm
wire_slot_w = 4;        // push-in slot of the gutter and the bracket groove (a bit under cable_d)

// ---------- chain link ----------
// Link frame: x along the chain (rear pivot x = 0, front pivot x = ch_p), z = 0 at the pivots,
// +z = the inside of the loop, y = 0 the chain's centre line. Printed in this orientation (floor on
// the bed). Each link: two OUTBOARD plates at the rear (with the pivot holes), a crosspiece, two
// INBOARD plates at the front (with the pivot pins), floor and roof bars between the inboard
// plates. The next link's outboard plates snap over this link's pins (they spring 0.7 mm apart).
// Channel 8 wide x 6.4 tall (needs >= 7 x 6 for the cable): thread the wires through.
// Stops: each pin is a teardrop (its tip points down: it prints without supports and is the stop
// key); the hole is the tip's sweep, so a joint bends from straight (0) to ch_bend (60) only:
// it cannot sag below straight, so the upper run holds itself up between the loop and the bracket.
ch_p   = 16;            // pitch (pivot to pivot)
ch_hz  = 4.7;           // half height (link 9.4 tall)
ch_w   = 8;             // channel width
ch_bar = 1.5;           // floor / roof thickness (channel 9.4 - 3 = 6.4 tall)
ch_t   = 1.5;           // plate thickness
ch_gap = 0.4;           // inboard plate to the next link's outboard plate
yi0 = ch_w / 2;  yi1 = yi0 + ch_t;  yo0 = yi1 + ch_gap;  yo1 = yo0 + ch_t;   // 4, 5.5, 5.9, 7.4
ch_half_w = yo1;        // link is 14.8 wide
cx0 = 9;  cx1 = 10.5;   // crosspiece (outboard plates' root)
front_r = 8.6;          // front end: round about the front pivot, clears the next crosspiece by 0.4
rear_r  = 5.3;          // rear end: round about the rear pivot, clears the last link's root by 0.2
pin_r = 1.5;  pin_tip = 2.3;  pin_fit = 0.15;  pin_out = 1.1;   // pin pokes 0.7 into the 1.5 plate
ch_bend = 60;           // max bend per joint -> bend radius 16 at the pivots (3 links per half turn)
sweep0 = 5.3;  sweep1 = 54.7;   // hole sweep; with pin_fit the stops land at 0.0 and 60.0 (joint.py)
ramp = 0.7;             // lead-in on the outboard plates' inner rear edge (they ride over the pins)

module yslab(a, b) translate([0, b, 0]) rotate([90, 0, 0]) linear_extrude(b - a) children();   // 2D (x, z) -> y a..b
module band() translate([-50, -ch_hz]) square([100, 2 * ch_hz]);
module pin2d() hull() { circle(r = pin_r, $fn = 32); translate([0, -pin_tip]) square(0.02, center = true); }
module hole2d() offset(r = pin_fit, $fn = 16) {
  steps = 10;
  for (i = [0 : steps - 1]) hull() for (a = [sweep0 + (sweep1 - sweep0) * i / steps, sweep0 + (sweep1 - sweep0) * (i + 1) / steps])
    rotate(-a) pin2d();
  hull() { circle(r = pin_r, $fn = 32); translate([0, (pin_r + pin_fit) * sqrt(2) - pin_fit]) square(0.02, center = true); }   // printable top
}
module rear2d() union() {
  intersection() { circle(r = rear_r, $fn = 48); band(); }
  translate([0, -ch_hz]) square([cx1, 2 * ch_hz]);
}
module front2d(x0 = cx0) intersection() {
  union() { translate([ch_p, 0]) circle(r = front_r, $fn = 64); translate([x0, -ch_hz]) square([ch_p - x0, 2 * ch_hz]); }
  translate([x0, -ch_hz]) square([ch_p + front_r - x0, 2 * ch_hz]);
}
module bars2d(x0 = cx0) intersection() {
  front2d(x0);
  union() { translate([-50, -ch_hz]) square([100, ch_bar]); translate([-50, ch_hz - ch_bar]) square([100, ch_bar]); }
}
module pins(x) for (m = [0, 1]) mirror([0, m, 0]) translate([x - ch_p, 0, 0]) hull() {
  yslab(yi1 - 0.01, yi1 + pin_out - 0.4) translate([ch_p, 0]) pin2d();
  yslab(yi1 + pin_out - 0.01, yi1 + pin_out) translate([ch_p, 0]) offset(delta = -0.4) pin2d();
}
module link_rear() for (m = [0, 1]) mirror([0, m, 0]) {   // outboard plates + crosspiece
  difference() {
    yslab(yo0, yo1) rear2d();
    translate([0, 0, 0]) yslab(yo0 - 1, yo1 + 1) hole2d();
    // lead-in: the plate's inner face is ramp thinner at the rear edge, full by x = -2.7
    hull() { translate([-rear_r - 1, yo0 - 1, -ch_hz - 1]) cube([1, 1 + ramp, 2 * ch_hz + 2]);
             translate([-2.7, yo0 - 1, -ch_hz - 1]) cube([0.01, 1, 2 * ch_hz + 2]); }
  }
  translate([cx0, yi0, -ch_hz]) cube([cx1 - cx0, yo1 - yi0, 2 * ch_hz]);
}
module link_front(x0 = cx0) {                              // inboard plates + bars + pins
  for (m = [0, 1]) mirror([0, m, 0]) yslab(yi0, yi1) front2d(x0);
  yslab(-yi1, yi1) bars2d(x0);
  pins(ch_p);
}
module chain_link() { link_rear(); link_front(); }
module print_link() translate([rear_r, ch_half_w, ch_hz]) chain_link();

// ---------- where the chain sits (world) ----------
ch_y    = 54.5;                      // chain centre line (tray channel y 46..63)
tr_z0   = 182;                       // tray underside (I2: >= 182)
tr_floor = 2.5;
ch_zlo  = tr_z0 + tr_floor + ch_hz;  // 189.2: lower run's pivots (links lie on the tray floor)
ch_R    = 16;                        // loop radius at the pivots (runs 32 apart; 60-degree stops allow 13.9)
ch_zhi  = ch_zlo + 2 * ch_R;         // 221.2: upper run's pivots = the moving end's pivot
ch_mx   = 15;                        // moving-end pivot is this far +x of the carriage centre
ch_n    = 10;                        // links
c_min = -95;  c_max = 78;            // carriage travel (plan)
ch_xf   = (c_min + c_max) / 2 + ch_mx;   // 6.5: fixed-end pivot = middle of the moving end's travel
// Loop position for carriage c: lower run + half circle + upper run = ch_n * ch_p (arc-length
// model, close enough for clash checks). Margin: the runs never get shorter than 11.6 mm.
function ch_xb(c) = (ch_n * ch_p - PI * ch_R + ch_xf + c + ch_mx) / 2;
function ch_pt(c, s) = let(a = ch_xb(c) - ch_xf, L = PI * ch_R)
  s <= a ? [ch_xf + s, ch_zlo] :
  s <= a + L ? let(f = (s - a) / ch_R * 180 / PI) [ch_xb(c) + ch_R * sin(f), ch_zlo + ch_R - ch_R * cos(f)] :
  [ch_xb(c) - (s - a - L), ch_zhi];
module chain_links(c) for (k = [1 : ch_n]) {
  p0 = ch_pt(c, (k - 1) * ch_p);  p1 = ch_pt(c, k * ch_p);
  translate([p0[0], ch_y, p0[1]]) rotate([0, -atan2(p1[1] - p0[1], p1[0] - p0[0]), 0]) chain_link();
}

// ---------- tray ----------
tr_y0 = 44;  tr_y1 = 76;             // I2 zone y 44..76
tr_x1 = col_x1;                      // spans x -170..170 (column outer faces)
tr_wall = 2;
tr_top = tr_z0 + tr_floor + 10;      // 194.5: walls 10 tall (the lower run is 9.4)
chan_y0 = tr_y0 + tr_wall;  chan_y1 = 63;     // chain channel 46..63 (17 wide, 1.1 clear a side)
gut_y0 = chan_y1 + tr_wall;  gut_y1 = tr_y1 - tr_wall;   // gutter 65..74
drop_x = 156;  drop_y = wire_b_y;    // I3: wires leave at x 156, y 69.5 onto the column clips
tr_split = -50;                      // halves: x -170..-50 (120) and -50..170 (220)
notch_x = [ch_xf - 36, ch_xf - 24];  // wires cross from the channel into the gutter here
rib_x = ch_xf - 14;                  // fixed end's locating ribs drop into grooves in the walls
foot_y1 = col_y1;                    // feet sit on the column tops (y 44..64)
module tray_whole() difference() {
  union() {
    translate([-tr_x1, tr_y0, tr_z0]) cube([2 * tr_x1, tr_y1 - tr_y0, tr_floor]);
    for (y = [tr_y0, chan_y1, gut_y1]) translate([-tr_x1, y, tr_z0]) cube([2 * tr_x1, tr_wall, tr_top - tr_z0]);
    // gutter lips (the cable pushes in past them); 45-degree undersides
    for (s = [0, 1]) translate([-tr_x1, s == 0 ? gut_y0 : gut_y1, tr_top]) rotate([0, 90, 0])
      linear_extrude(2 * tr_x1) polygon(s == 0 ? [[0, 0], [0, (gut_y1 - gut_y0 - wire_slot_w) / 2], [(gut_y1 - gut_y0 - wire_slot_w) / 2, 0]]
                                                 : [[0, 0], [0, -(gut_y1 - gut_y0 - wire_slot_w) / 2], [(gut_y1 - gut_y0 - wire_slot_w) / 2, 0]]);
    for (s = [-1, 1]) translate([s > 0 ? tr_x1 - tr_wall : -tr_x1, tr_y0, tr_z0]) cube([tr_wall, tr_y1 - tr_y0, tr_top - tr_z0]);   // end walls
    for (s = [-1, 1]) mirror([s < 0 ? 1 : 0, 0, 0]) {
      translate([col_x0, tr_y0, stand_top]) cube([col_x1 - col_x0, foot_y1 - tr_y0, tr_z0 - stand_top + 0.01]);   // foot
      for (y = tray_peg_y) translate([tray_peg_x, y, 0]) rotate(45) hull() {                              // pegs
        translate([-tray_peg_s / 2, -tray_peg_s / 2, stand_top - tray_sock_d + 1.5]) cube([tray_peg_s, tray_peg_s, tray_sock_d - 1.5 + 0.01]);
        translate([-tray_peg_s / 2 + 0.8, -tray_peg_s / 2 + 0.8, stand_top - tray_sock_d + 0.5]) cube([tray_peg_s - 1.6, tray_peg_s - 1.6, 1]);
      }
    }
  }
  translate([notch_x[0], chan_y1 - 1, tr_z0 + tr_floor + 2.5]) cube([notch_x[1] - notch_x[0], tr_wall + 2, 20]);   // wire crossing
  translate([drop_x, drop_y, tr_z0 - 1]) cylinder(d = 7.5, h = tr_floor + 2, $fn = 32);                         // wire drop
  for (y = [chan_y0 - 1, chan_y1]) translate([rib_x - 1.2, y, tr_z0 + tr_floor + 3]) cube([2.4, 1 + 0.01, 20]);  // rib grooves (1 deep)
}
// Middle joint: a vertical dovetail. Each half ends in a solid bulkhead (nothing runs through the
// tray left of x -30: the lower run and the wires start right of it); the left half's tenon drops
// into the right half's mortise from above and rests on the right half's floor. Lift to undo.
dv_y = 60;  dv_root = 14;  dv_tip = 18;  dv_len = 5;  dv_fit = 0.2;
module dovetail2d(c = 0) polygon([[tr_split - c, dv_y - dv_root / 2 - c], [tr_split + dv_len + c, dv_y - dv_tip / 2 - c],
                                  [tr_split + dv_len + c, dv_y + dv_tip / 2 + c], [tr_split - c, dv_y + dv_root / 2 + c]]);
module tray_left() {
  intersection() { tray_whole(); translate([-tr_x1 - 1, 0, 0]) cube([tr_split + tr_x1 + 1, 200, 400]); }
  translate([tr_split - 6, tr_y0, tr_z0]) cube([6, tr_y1 - tr_y0, tr_top - tr_z0]);
  translate([0, 0, tr_z0 + tr_floor]) linear_extrude(tr_top - tr_z0 - tr_floor) dovetail2d();
}
module tray_right() difference() {
  union() {
    intersection() { tray_whole(); translate([tr_split, 0, 0]) cube([tr_x1 - tr_split + 1, 200, 400]); }
    translate([tr_split, tr_y0, tr_z0]) cube([8, tr_y1 - tr_y0, tr_top - tr_z0]);
  }
  translate([0, 0, tr_z0 + tr_floor]) linear_extrude(tr_top - tr_z0) dovetail2d(dv_fit);
}
// printed upside down: wall tops on the bed, floor on top, feet and pegs pointing up
module print_tray_left()  translate([0, 0, tr_top]) rotate([180, 0, 0]) tray_left();
module print_tray_right() translate([0, 0, tr_top]) rotate([180, 0, 0]) tray_right();

// ---------- fixed end (clips into the tray) ----------
// A link's front end (inboard plates, bars, pins) on a block that fills the channel. Two ribs on its
// sides drop into the grooves in the channel walls: it can't slide, it lifts out. Wires leave its
// rear (-x), cross the notch into the gutter, then run +x to the right stand.
fx_back = 22;                       // block from x -22 to -5.6 (link frame)
fx_hw = (chan_y1 - chan_y0) / 2 - 0.2;   // 8.3
module chain_fixed() {
  difference() {
    translate([-fx_back, -fx_hw, -ch_hz]) cube([fx_back - rear_r - 0.3, 2 * fx_hw, 2 * ch_hz]);
    translate([-fx_back - 1, -yi0, -ch_hz + ch_bar]) cube([fx_back + 2, 2 * yi0, 2 * (ch_hz - ch_bar)]);
  }
  translate([-ch_p, 0, 0]) link_front(x0 = ch_p - 9);
  for (m = [0, 1]) mirror([0, m, 0]) translate([rib_x - ch_xf - 1, fx_hw - 0.01, -ch_hz + 3 + 0.4]) cube([2, 0.8 + 0.01, 2 * ch_hz - 3 - 0.4]);
}
module chain_fixed_world() translate([ch_xf, ch_y, ch_zlo]) chain_fixed();
module print_fixed() translate([fx_back, fx_hw + 0.8, ch_hz]) chain_fixed();

// ---------- moving end (plugs into the carriage, I1) ----------
// From the upper run (a link's rear end turned upside down) a short arm goes forward over the
// tray's front wall to a post in front of the tray, which comes down to the 8 x 8 stem in the
// carriage's socket (centre x = c, y 32.5, top face z 180). The wires come out of the chain into a
// groove along the arm's top, then down a groove on the post's -x face to the pen motor.
sock_y = 32.5;  sock_z = 180;  stem = 8.0;  stem_len = 6.5;   // socket is 7 deep: 0.5 spare
post_x = 6;                         // post and arm: x c-6..c+6 (the chain's end is at x c+15)
post_y0 = sock_y - stem / 2;  post_y1 = tr_y0 - 1.5;   // 28.5..42.5 (1.5 clear of the tray)
module stem_snap() difference() {   // split stem with two 0.25 bumps: clicks into the 8.2 socket
  union() {
    translate([-stem / 2, -stem / 2, -stem_len + 0.6]) cube([stem, stem, stem_len - 0.6 + 0.01]);
    for (m = [0, 1]) mirror([0, m, 0]) hull() {
      translate([-stem / 2 + 1, stem / 2 - 0.01, -stem_len + 1.5]) cube([stem - 2, 0.26, 1.5]);
      translate([-stem / 2 + 1, stem / 2 - 0.01, -stem_len + 0.8]) cube([stem - 2, 0.01, 2.9]);
    }
    hull() {   // chamfered tip
      translate([-stem / 2, -stem / 2, -stem_len + 0.6]) cube([stem, stem, 0.01]);
      translate([-stem / 2 + 0.6, -stem / 2 + 0.6, -stem_len]) cube([stem - 1.2, stem - 1.2, 0.01]);
    }
  }
  translate([-stem / 2 - 1, -0.6, -stem_len - 1]) cube([stem + 2, 1.2, 5.5]);   // split
}
module chain_moving(c) {
  zt = ch_zhi + ch_hz;  zb = ch_zhi - ch_hz;
  translate([c + ch_mx, ch_y, ch_zhi]) rotate([0, 180, 0]) link_rear();
  difference() {
    union() {
      translate([c - post_x, post_y0, zb]) cube([2 * post_x, ch_y + ch_half_w - post_y0, 2 * ch_hz]);   // arm
      translate([c - post_x, post_y0, sock_z]) cube([2 * post_x, post_y1 - post_y0, zb - sock_z + 0.01]);   // post
    }
    // wire groove: from the chain's channel along the arm top, then down the post's -x face
    translate([c - 3, ch_y - yi0, ch_zhi - (ch_hz - ch_bar)]) cube([post_x + 3 + 0.01, 2 * yi0, 10]);
    translate([c - 3, 36, ch_zhi - (ch_hz - ch_bar)]) cube([6, ch_y + yi0 - 36, 10]);
    translate([c - post_x + 1, 36, sock_z + 4]) cube([5, 5, zt - sock_z]);
    translate([c - post_x - 1, 38.5 - wire_slot_w / 2, sock_z + 4]) cube([3, wire_slot_w, zt - sock_z]);
  }
  translate([c, sock_y, sock_z]) stem_snap();
}
module print_moving() translate([post_x, -post_y0, ch_zhi + ch_hz]) rotate([0, 180, 0]) chain_moving(0);

// ---------- assembly + checks ----------
c_tray = "#7a8f3a";  c_chain = "#303438";
module carriage_at(c) translate([c, 0, lift]) { blocks(); carriage_plate(); stage(); slider(); pen_clip(); knob(); }
module pen_at(c) translate([c, 0, lift]) the_pen();
module frame_static() {
  frame_base(); stand_right(); stand_left();
  translate([mx, col_y0, belt_z]) rotate([-90, 0, 0]) nema17();
  for (z = [rod_lo, rod_hi]) translate([-rod_len / 2, rod_y, z]) rotate([0, 90, 0]) cylinder(d = 8, h = rod_len);
  translate([-ix, rod_y - 5.075, belt_z]) rotate([-90, 0, 0]) pulley_m3();
  translate([0, 0, lift]) { x_belt(); x_pulley(); }
}
module chain_moving_set(c) { chain_links(c); chain_moving(c); }
module tray_set() { tray_left(); tray_right(); chain_fixed_world(); }
module chain_assembly(c) {
  color(c_print) frame_base();
  color(c_print) stand_right();
  color(c_print) stand_left();
  color(c_dark) translate([mx, col_y0, belt_z]) rotate([-90, 0, 0]) nema17();
  color(c_metal) for (z = [rod_lo, rod_hi]) translate([-rod_len / 2, rod_y, z]) rotate([0, 90, 0]) cylinder(d = 8, h = rod_len);
  color(c_wheel) translate([-ix, rod_y - 5.075, belt_z]) rotate([-90, 0, 0]) pulley_m3();
  color(c_wheel) translate([0, pen_y, wheel_z0]) platter_wheel();
  translate([c, 0, lift]) {
    color(c_metal) blocks();
    color(c_print) carriage_plate();
    color("#d8d8d0") { stage(); slider(); }
    color(c_print) { pen_clip(); knob(); }
    color("#c03030") the_pen();
  }
  color(c_tray) { tray_left(); tray_right(); }
  color("#b8862b") chain_fixed_world();
  color(c_chain) chain_links(c);
  color("#b8862b") chain_moving(c);
}

if (part == "chain_assembly") chain_assembly(chain_c);
if (part == "chain_link")     chain_link();
if (part == "print_link")     print_link();
if (part == "chain_fixed")    print_fixed();
if (part == "chain_moving")   print_moving();
if (part == "tray_left")      print_tray_left();
if (part == "tray_right")     print_tray_right();
if (part == "tray_world")     { tray_left(); tray_right(); }
// two links at a bend angle (joint check): -D ang=30
ang = 0;
if (part == "joint")          { chain_link(); translate([ch_p, 0, 0]) rotate([0, -ang, 0]) chain_link(); }
if (part == "joint_x")        intersection() { chain_link(); translate([ch_p, 0, 0]) rotate([0, -ang, 0]) chain_link(); }
// clash checks at carriage c: each should be empty
if (part == "x_chain_tray")     intersection() { chain_moving_set(chain_c); tray_set(); }
if (part == "x_chain_frame")    intersection() { chain_moving_set(chain_c); frame_static(); }
if (part == "x_chain_carriage") intersection() { chain_moving_set(chain_c); union() { carriage_at(chain_c); pen_at(chain_c); } }
if (part == "x_tray_carriage")  intersection() { tray_set(); union() { carriage_at(chain_c); pen_at(chain_c); } }
if (part == "x_tray_frame")     intersection() { tray_set(); frame_static(); }
// groups as STL (for clearance measurements)
if (part == "g_moving")   chain_moving_set(chain_c);
if (part == "g_tray")     tray_set();
if (part == "g_carriage") carriage_at(chain_c);
if (part == "g_pen")      pen_at(chain_c);
if (part == "g_frame")    frame_static();

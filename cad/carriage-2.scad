// Carriage 2 + pen head (2026-11-15). Replaces Tim's carriage plate (base_plate), the double-sided
// tape, the guide's clip + gear knob + screw, and the pen holder.
// Tim: "I don't really want to get any more bolts/screws ... I used double sided tape for the rod
// bearings and the carraige plate ... Are there smart connectors or something like that that would
// hold them together but would also be able to easily be taken apart when needed?"
// Tim: "the pen holder itself I think can be improved. The little gear thing ... you need to cut off
// the head of the screw ... it's messy ... when I had bigger pens like a sharpie, the round holder of
// the pen holder wasn't big enough to hold it nicely" and "we would be able to make a spring loaded
// pen holder that can lift up off the platter on command and all be 3D printed?"
// Plan: docs/upgrades-plan.md (interfaces I1-I7). All PLA, no supports, no screws, no tape.
//
// Four prints, all toolless:
//  1. carriage2_plate: snaps onto the four SC8UU blocks (pegs in their M4 holes for position, two
//     springy jaws with barbs over the blocks' outer top/bottom faces). Belt pegs exactly where they
//     were. The stage drops into the same pocket as before (24.9 x 81.3 + 0.3 a side, which Tim's
//     plate showed fits), now 3.5 deep instead of 1.5.
//  2. carriage2_frame: pushed on from the front over the stage; four springy fingers hook behind the
//     plate's side edges (inside short windows, so it can't slide up or down). Two straps lie across
//     the stage's end caps (past the slider's travel) and hold it in the pocket; its top carries the
//     cable-chain socket (I1) and sits on the stage motor, so the stage can't lift.
//  3. pen head: one print = slider cap (push-on, crush ribs) + parallelogram flexure (4 printed
//     leaves, 3.5 mm of spring travel to a hard stop) + collet housing (taper + internal thread).
//  4. sleeve (knurled, screws into the housing and pushes the collet into the taper) + one collet per
//     pen size. The taper centres every collet on the same axis, so the tip stays on the pen line.
// Assembly: plate onto the blocks (push straight on) -> stage into the pocket -> frame on (push until
// the 4 fingers click) -> pen head onto the slider (push straight back) -> collet + pen in from the
// top, sleeve screwed down by hand until the pen can't slide. Take apart in reverse; nothing needs
// a tool (spread the frame's fingers or pull firmly).
//
// One part: openscad -D 'part="c2_plate"' carriage-2.scad (names at the bottom).

include <printed-frame.scad>    // world frame, stands, wheel (read only, owned by builder `chain`)

part = "c2_assembly";
c2_c  = 0;        // carriage centre (world x) in the assembly / clash views: -95 .. +78
c2_sb = -1;       // slider bottom (world z) in the views; -1 = where a pen with ph_stick out touches

// ======================= sizes of bought parts NOT measured yet (I7) =======================
sc_face   = 34;   // ASSUMED, measure: SC8UU block height across the rod (spec 34)
sc_len    = 30;   // ASSUMED, measure: SC8UU length along the rod (spec 30)
sc_flange = 14;   // ASSUMED, measure: how far back from its mounting face the block keeps its full
                  //   34 height before its top/bottom faces step or slope inward (the barbs sit there)
sc_slope  = 5 / 8;// ASSUMED, measure: how steeply they slope in after that (model: 5 mm over 8 mm)
sc_hole_x = 9;  sc_hole_z = 12;   // ASSUMED (spec): M4 holes 18 x 24 on the mounting face
sc_peg_d  = 2.9;  sc_peg_h = 2.5; // printed pegs into those M4 holes (minor diameter ~3.2)
st_d      = 10;   // ASSUMED, measure: stage body depth, front to back, WITHOUT the slider
st_cap    = 4;    // ASSUMED, measure: stage end caps (the solid ends past the slider's travel)
st_motor  = 15;   // ASSUMED: stage motor can diameter (its top sits under the chain socket)
st_nub    = 1.5;  st_nub_d = 6;   // ASSUMED: bump on the motor's top
sl_w = 25;  sl_h = 14;  sl_d = 10;// ASSUMED, measure: slider width, height (along the travel), how
                                  //   far it sticks out in front of the stage body
ph_pens   = [8, 9.5, 11, 12.5, 14, 16];   // ASSUMED, measure: every pen's diameter 10-20 mm above
                                          //   its tip (that is where the collet grips). One collet each.
ph_stick  = 12;   // pen tip below the housing (the assembly view; anything 3.4 .. 26.6 works)

// ======================= stage pocket (Tim's plate: "fit perfectly") =======================
st_w = 24.9;  st_len = 81.3;  st_fit = 0.3;
c2_face   = rod_y - sc8uu_h;                  // 39: blocks' mounting face = plate back face
c2_y0     = 34;                               // plate front face (its print-bed face)
c2_top    = 180;                              // I2: nothing on the carriage above this
st_back   = c2_face - 1.5;                    // 37.5: stage back (same place as on Tim's plate)
st_front  = st_back - st_d;                   // 27.5
sl_front  = st_front - sl_d;                  // 17.5
pk_z1     = belt_z + 47.5 - ((95 - st_len) / 2 - st_fit);   // 171.45: same pocket as Tim's plate
pk_z0     = pk_z1 - st_len - 2 * st_fit;      // 89.55: the stage stands on this
pk_x      = st_w / 2 + st_fit;                // 12.75
lo_bot    = rod_lo - sc_face / 2;             // 82.5  lower blocks' bottom
lo_top    = rod_lo + sc_face / 2;             // 116.5
hi_bot    = rod_hi - sc_face / 2;             // 144.5
hi_top    = rod_hi + sc_face / 2;             // 178.5 upper blocks' top
c2_x      = 28.5;                             // half width: same envelope as Tim's plate

// ======================= plate =======================
jaw_lo_t  = 1.9;                              // lower jaw (z 80.5 .. 82.4)
c2_z0     = lo_bot - 0.1 - jaw_lo_t;          // 80.5
jaw_x     = [11, 22];                         // jaw fingers (each side): narrow, so they flex by hand
barb_y    = c2_face + sc_flange + 2;          // barb tips 2 mm onto the slope ...
barb_pre  = 0.2;                              // ... pressing 0.2 into it: pulls the plate onto the blocks
barb_h    = 2 * sc_slope + barb_pre + 0.1;    // 1.55
jaw_y1    = barb_y + barb_h + 0.05;
cb_x      = 24.5;                             // middle block (between the rods): clear of the idler fork
cb_y1     = c2_face - 2 + 8.17;               // 45.17, as on Tim's plate
peg_x = 19.5;  peg_y0 = c2_face - 2;  peg_zc = belt_z + 47.5 - 55;   // belt pegs, unchanged (z 123)
blk_pegs  = [[6, rod_lo - sc_hole_z], [6, rod_lo + sc_hole_z], [6, rod_hi - sc_hole_z], [24, rod_hi + sc_hole_z]];
notch_x   = [-10, 6.5];                       // socket notch + a slot (x -10..-6.1) for the stage motor's
                                              //   wires on the -x side, where the cable chain brings them down
// frame fingers and the plate windows they hook into
fg_x0 = 27.5;  fg_x1 = c2_x;                  // finger, 1.0 thick
fr_x1 = 27.0;                                 // frame body outer edge (= plate lip in the windows)
lip_x = 27.0;  lip_y = 0.6;  bev_x = 25.4;    // plate edge in a window: lip, 45 degree bevel, then 25.4
fg_lo = [pk_z0 - 5.55, pk_z0 + 7.95];         // 84.0 .. 97.5
fg_hi = [pk_z1 - 13.95, pk_z1 - 0.45];        // 157.5 .. 171.0
win_c = 0.25;                                 // window clearance on each end (the frame's z play)

module barb(y, z, h, dir) {                   // ridge along x: 45 degree faces, tip h from the jaw
  translate([0, 0, z]) rotate([90, 0, 90]) linear_extrude(2 * c2_x, center = true)
    polygon([[y - h, 0], [y, dir * h], [y + h, 0]]);
}
module c2_window_cut(z0, z1) for (s = [-1, 1]) mirror([s < 0 ? 1 : 0, 0, 0])
  translate([0, 0, z0]) linear_extrude(z1 - z0)
    polygon([[lip_x, c2_y0 - 1], [c2_x + 1, c2_y0 - 1], [c2_x + 1, c2_face + 1], [bev_x, c2_face + 1],
             [bev_x, c2_y0 + lip_y + lip_x - bev_x], [lip_x, c2_y0 + lip_y]]);
module c2_plate() difference() {
  union() {
    translate([-c2_x, c2_y0, c2_z0]) cube([2 * c2_x, c2_face - c2_y0, c2_top - c2_z0]);
    translate([-cb_x, c2_face - 0.1, lo_top + 0.25]) cube([2 * cb_x, cb_y1 - c2_face + 0.1, hi_bot - lo_top - 0.5]);
    for (x = [-peg_x, peg_x]) translate([x, peg_y0 + 2, peg_zc]) rotate([-90, 0, 0]) {
      cylinder(d = 6.4, h = 17.67 - 2, $fn = 48);
      translate([0, 0, 17.67 - 2]) cylinder(d = 10, h = 2, $fn = 48);
    }
    for (s = [-1, 1]) mirror([s < 0 ? 1 : 0, 0, 0]) {
      // lower jaw finger + barb (up), upper jaw finger + barb (down)
      translate([jaw_x[0], c2_face - 0.1, c2_z0]) cube([jaw_x[1] - jaw_x[0], jaw_y1 - c2_face + 0.1, jaw_lo_t]);
      translate([jaw_x[0], c2_face - 0.1, hi_top + 0.1]) cube([jaw_x[1] - jaw_x[0], jaw_y1 - c2_face + 0.1, c2_top - hi_top - 0.1]);
      intersection() {
        union() { barb(barb_y, lo_bot - 0.1, barb_h, 1); barb(barb_y, hi_top + 0.1, barb_h, -1); }
        translate([jaw_x[0], 0, 0]) cube([jaw_x[1] - jaw_x[0], 100, 300]);
      }
    }
    for (p = blk_pegs, s = [-1, 1]) translate([s * p[0], c2_face - 0.1, p[1]]) rotate([-90, 0, 0]) {
      cylinder(d = sc_peg_d, h = sc_peg_h - 0.4 + 0.1, $fn = 24);
      translate([0, 0, sc_peg_h - 0.4 + 0.1]) cylinder(d1 = sc_peg_d, d2 = sc_peg_d - 0.8, h = 0.4, $fn = 24);
    }
  }
  translate([-pk_x, c2_y0 - 1, pk_z0]) cube([2 * pk_x, st_back - c2_y0 + 1, pk_z1 - pk_z0]);   // stage pocket
  translate([notch_x[0], c2_y0 - 1, pk_z1 - 0.01]) cube([notch_x[1] - notch_x[0], c2_face - c2_y0 + 2, 20]);
  // back-face relief between the blocks, outside the middle block: at the far left (c = -95) the
  // idler fork's front cheek is flush with the blocks' face (y 39), so the plate's edge stands 0.6 off it
  for (s = [-1, 1]) translate([s > 0 ? cb_x - 0.01 : -c2_x - 1, c2_face - 0.6, lo_top + 0.25])
    cube([c2_x - cb_x + 1.01, 1, hi_bot - lo_top - 0.5]);
  c2_window_cut(fg_lo[0] - win_c, fg_lo[1] + win_c);
  c2_window_cut(fg_hi[0] - win_c, fg_hi[1] + win_c);
}

// ======================= frame (stage clip + chain socket) =======================
fr_y0  = 25.3;                       // its front (print-bed) face; the pen head's post stays in front
fr_in  = 15.5;                       // cheeks start here (the slider cap is 14.6 wide a side)
fr_bar = 19;                         // side bars fr_in .. fr_bar
sk_w = 8.2;  sk_d = 7;  sk_y = 32.5; // I1 socket hole
sk_wall = 2;
sk_y1 = sk_y + sk_w / 2 + sk_wall;   // 38.6: its back wall sits in the plate's notch
strap_y1 = st_front - 0.15;          // straps lie 0.15 in front of the end caps
module c2_finger(z0, z1, root_lo) {  // +x side
  translate([fg_x0, fr_y0, z0]) cube([fg_x1 - fg_x0, c2_face - 0.25 - fr_y0, z1 - z0]);   // stops 0.25 short of the blocks
  // root: joins the finger to the cheek, in front of the plate only
  translate([fr_x1 - 0.01, fr_y0, root_lo ? z0 - 2 : z1]) cube([fg_x1 - fr_x1 + 0.01, c2_y0 - fr_y0, 2]);
  // hook: catch face parallel to the plate's bevel, 0.2 off it; lead-in face behind
  cy = c2_y0 + lip_y + 0.2 * sqrt(2);                       // the catch line: y - cy = -(x - lip_x)
  tip_x = bev_x + 0.25;
  translate([0, 0, z0]) linear_extrude(z1 - z0)
    polygon([[fg_x0 + 0.01, cy - (fg_x0 - lip_x)], [tip_x, cy + (lip_x - tip_x)],
             [fg_x0 + 0.01, cy + (lip_x - tip_x) + (fg_x0 - tip_x)]]);
}
module c2_frame() difference() {
  union() {
    for (s = [-1, 1]) mirror([s < 0 ? 1 : 0, 0, 0]) {
      translate([fr_in, fr_y0, fg_lo[0]]) cube([fr_x1 - fr_in, c2_y0 - fr_y0, fg_lo[1] + 2 - fg_lo[0]]);   // lower cheek
      translate([fr_in, fr_y0, fg_hi[0] - 2]) cube([fr_x1 - fr_in, c2_y0 - fr_y0, c2_top - fg_hi[0] + 2]);  // upper cheek
      translate([fr_in, fr_y0, fg_lo[1]]) cube([fr_bar - fr_in, c2_y0 - fr_y0, fg_hi[0] - fg_lo[1]]);       // side bar
      c2_finger(fg_lo[0], fg_lo[1], false);
      c2_finger(fg_hi[0], fg_hi[1], true);
    }
    // straps across the stage's end caps
    for (z = [pk_z0, pk_z0 + 70 - st_cap]) translate([-fr_in - 0.01, fr_y0, z + 0.3]) cube([2 * fr_in + 0.02, strap_y1 - fr_y0, st_cap - 0.6]);
    // top bar over the stage motor + socket
    translate([-fr_x1, fr_y0, pk_z1]) cube([2 * fr_x1, c2_y0 - fr_y0, c2_top - pk_z1]);
    translate([-sk_w / 2 - sk_wall, fr_y0, pk_z1]) cube([sk_w + 2 * sk_wall, sk_y1 - fr_y0, c2_top - pk_z1]);
  }
  translate([-sk_w / 2, sk_y - sk_w / 2, c2_top - sk_d]) cube([sk_w, sk_w, sk_d + 1]);          // I1 hole
  // groove for the motor's top bump, open to the front so the frame can be pushed on over it
  translate([-st_nub_d / 2 - 0.5, fr_y0 - 1, pk_z1 - 1]) cube([st_nub_d + 1, st_front + 2.5 + st_nub_d / 2 + 0.5 - fr_y0 + 1, 1.85]);
}

// ======================= pen head =======================
// Head coordinates: x from the carriage centre, y = world y, z = 0 at the housing's bottom.
ph_clear = 0.3;                      // collet bore = pen + this
ph_nose  = max(ph_pens) + ph_clear + 2 * 1.4;   // 19.1: collet nose OD, same for every collet
ph_tan   = tan(8);                   // taper, 8 degrees a side (self-locking like an ER collet)
ph_ct    = 12;                       // collet taper length
ph_c1    = ph_nose + 2 * ph_tan * ph_ct;        // 22.47
ph_hb0   = ph_nose + 1.0;            // housing taper bore at the bottom
ph_ht    = 13;                       // housing taper height
ph_hb1   = ph_hb0 + 2 * ph_tan * ph_ht;         // 23.75
ph_P = 3;  ph_td = 1.0;              // thread pitch / depth (45 degree flanks, prints without supports)
ph_tM    = 25.0;                     // sleeve thread outer diameter (inner 23.0 > collet 22.47 + 0.5)
ph_tc    = 0.25;                     // radial thread clearance
ph_tz0 = 18;  ph_tz1 = 28;           // housing thread
ph_hod   = 27.0;                     // housing OD under the thread
ph_hod2  = ph_tM + 2 * ph_tc + 3.3;  // 28.8 at the thread
ph_grip  = (ph_hb0 - ph_nose - 0.8) / (2 * ph_tan);   // nose height when it squeezes 0.8 (pen 0.3 + 0.5 grip)
ph_lc    = ph_tz0 - ph_grip;         // collet length: sleeve fully down = tightest
ph_slot  = 15;  ph_slot_w = 1.2;
ph_sid   = max(ph_pens) + 1;         // sleeve bore: the fattest pen passes
ph_skd = 29;  ph_skh = 6;            // sleeve knurl
ph_lx0   = ph_hod / 2 + 1;           // leaves x 14.5 .. 19.5
ph_lw    = 5;   ph_lt = 0.6;         // leaf width / thickness (3 layers)
ph_lz2   = 16.0;                     // upper leaves
ph_pf    = pen_y + ph_hod / 2 + 1;   // 17.5 lower post front
ph_pf2   = pen_y + ph_hod2 / 2 + 1.1;// 18.5 upper post front
ph_pb    = fr_y0 - 0.8;              // 24.5 post back
ph_yk    = pen_y - ph_hod / 2 - 2;   // -12.5 yoke back face
ph_trav  = 3.5;                      // spring travel to the hard stop (tooth under the notch roof)
ph_fz0   = ph_tz1 + ph_skh + 3 + ph_trav + 0.4;   // 40.9: flare starts above the sleeve's highest point
ph_cfront= sl_front - 0.1 - 2.0;     // 15.4
ph_fz1   = ph_fz0 + (ph_pf2 - ph_cfront);         // 44.0 (45 degree flare)
ph_sb    = ph_fz1 + 2.5;             // 46.5: slider bottom in head coordinates
ph_cx    = sl_w / 2 + 0.1;           // 12.6 cap cavity half width
ph_cw    = ph_cx + 2;                // 14.6
ph_cback = st_front - 0.3;           // 27.2
ph_top   = ph_sb + sl_h + 0.1 + 2.5; // 63.1

function thr_r(u, rmin, d, P) = let(a = P / 6, b = P / 3, w = u - P * floor(u / P))
  w < a ? rmin : w < a + b ? rmin + d * (w - a) / b : w < 2 * a + b ? rmin + d : rmin + d - d * (w - 2 * a - b) / b;
module thread_solid(rmin, d, P, h, n = 96)
  linear_extrude(h, twist = -360 * h / P, slices = ceil(h / P * 24), convexity = 8)
    polygon([for (i = [0 : n - 1]) let(t = 360 * i / n, r = thr_r(P * i / n, rmin, d, P)) [r * cos(t), r * sin(t)]]);

module ph_housing() difference() {   // at the pen axis
  union() {
    cylinder(d = ph_hod, h = ph_tz0 - 0.9, $fn = 96);
    translate([0, 0, ph_tz0 - 0.9]) cylinder(d1 = ph_hod, d2 = ph_hod2, h = 0.9, $fn = 96);
    translate([0, 0, ph_tz0]) cylinder(d = ph_hod2, h = ph_tz1 - ph_tz0, $fn = 96);
  }
  translate([0, 0, -0.01]) cylinder(d1 = ph_hb0, d2 = ph_hb1, h = ph_ht + 0.02, $fn = 96);
  translate([0, 0, ph_ht]) cylinder(d = ph_hb1, h = ph_tz0 - ph_ht + 0.01, $fn = 96);
  translate([0, 0, ph_tz0 - 0.01]) thread_solid(ph_tM / 2 - ph_td + ph_tc, ph_td, ph_P, ph_tz1 - ph_tz0 + 1);
  translate([0, 0, ph_tz1 - 0.6]) cylinder(d1 = ph_tM + 2 * ph_tc - 0.2, d2 = ph_tM + 2 * ph_tc + 1.2, h = 0.61, $fn = 96);
}
module ph_body() {
  translate([0, pen_y, 0]) ph_housing();
  translate([-2.5, pen_y + ph_hod / 2 - 1.5, 0]) cube([5, ph_pf + 2.1 - (pen_y + ph_hod / 2 - 1.5), 2]);   // stop tooth
  translate([-ph_lx0 - ph_lw, ph_yk - 3, 0]) cube([2 * (ph_lx0 + ph_lw), 3, ph_lz2 + ph_lt]);          // yoke bar
  translate([-5, ph_yk - 0.1, 0]) cube([10, 2.5, ph_lz2 + ph_lt]);                                     // yoke -> housing
  for (s = [-1, 1], z = [0, ph_lz2]) translate([s > 0 ? ph_lx0 : -ph_lx0 - ph_lw, ph_yk - 0.1, z])
    cube([ph_lw, ph_pf - ph_yk + 0.2, ph_lt]);                                                          // leaves
  difference() {                                                                                        // lower post
    translate([-ph_lx0 - ph_lw, ph_pf, 0]) cube([2 * (ph_lx0 + ph_lw), ph_pb - ph_pf, 17]);
    translate([-3.1, ph_pf - 0.1, -1]) cube([6.2, 2.8, 1 + 2 + ph_trav]);                               // stop notch
  }
  translate([-sl_w / 2, ph_pf2, 16.9]) cube([sl_w, ph_pb - ph_pf2, ph_fz0 - 16.9]);                     // upper post
  hull() {
    translate([-sl_w / 2, ph_pf2, ph_fz0 - 0.01]) cube([sl_w, ph_pb - ph_pf2, 0.01]);
    translate([-ph_cw, ph_cfront, ph_fz1 - 0.01]) cube([2 * ph_cw, ph_cback - ph_cfront, 0.01]);
  }
  difference() {                                                                                        // slider cap
    translate([-ph_cw, ph_cfront, ph_fz1]) cube([2 * ph_cw, ph_cback - ph_cfront, ph_top - ph_fz1]);
    translate([-ph_cx, sl_front - 0.1, ph_sb]) cube([2 * ph_cx, 20, sl_h + 0.1]);
  }
  for (s = [-1, 1], y = [20, 23.5, 26.5]) translate([s * (ph_cx - 0.25 + 0.5), y, ph_sb])               // crush ribs
    cylinder(r = 0.5, h = sl_h + 0.1, $fn = 16);
}
module ph_sleeve() difference() {    // z 0 = its thread's bottom; knurled head on top
  union() {
    intersection() {
      thread_solid(ph_tM / 2 - ph_td, ph_td, ph_P, ph_tz1 - ph_tz0);
      translate([0, 0, -0.01]) cylinder(d1 = ph_tM - 1.2, d2 = ph_tM + 20, h = 10.6, $fn = 96);   // lead-in
    }
    translate([0, 0, ph_tz1 - ph_tz0]) difference() {
      cylinder(d = ph_skd, h = ph_skh, $fn = 96);
      for (i = [0 : 23]) rotate(i * 15) translate([ph_skd / 2 + 0.3, 0, -1]) cylinder(d = 1.6, h = ph_skh + 2, $fn = 12);
    }
  }
  translate([0, 0, -1]) cylinder(d = ph_sid, h = 30, $fn = 96);
  translate([0, 0, ph_tz1 - ph_tz0 + ph_skh - 0.8]) cylinder(d1 = ph_sid, d2 = ph_sid + 1.8, h = 0.81, $fn = 96);
}
module ph_collet(d) difference() {   // z 0 = nose (bottom, in the taper)
  union() {
    cylinder(d1 = ph_nose, d2 = ph_c1, h = ph_ct, $fn = 96);
    translate([0, 0, ph_ct - 0.01]) cylinder(d = ph_c1, h = ph_lc - ph_ct + 0.01, $fn = 96);
  }
  translate([0, 0, -1]) cylinder(d = d + ph_clear, h = ph_lc + 2, $fn = 96);
  translate([0, 0, -0.01]) cylinder(d1 = d + ph_clear + 1, d2 = d + ph_clear, h = 0.5, $fn = 96);    // pen lead-in
  for (a = [0 : 90 : 270]) rotate(a + 45) translate([-ph_slot_w / 2, 0, -1]) cube([ph_slot_w, ph_c1, ph_slot + 1]);
}
// where the head sits: slider bottom sb (world z); pen tip at the paper when sb = c2_sb_touch
paper_z = plate_top + pad_t + paper_t;      // 66.6
function c2_sb_touch(stick) = paper_z + stick + ph_sb;
sb_min = pk_z0 + st_cap + 2.5 + 0.2;        // the cap meets the lower strap
sb_max = pk_z0 + 70 - st_cap - (ph_top - ph_sb) - 0.2;   // the cap meets the upper strap

// ======================= assembly / checks =======================
module c2_blocks(c) for (x = [-sc_len / 2, sc_len / 2], z = [rod_lo, rod_hi]) translate([c + x, c2_face, z]) sc8uu();
module c2_belt(c) translate([0, rod_y + 3, belt_z]) rotate([90, 0, 0])
  open_belt(-ix, 6.37, mx, 5.09, [c - peg_x, c + peg_x], peg_zc - belt_z, 3.2);
module c2_stage(c) translate([c - 12.5, st_front, pk_z0]) {
  linear_stage();
}
module c2_slider(c, sb) translate([c - sl_w / 2, sl_front, sb]) stage_slider();
module c2_head(c, sb) translate([c, 0, sb - ph_sb]) ph_body();
module c2_head_parts(c, sb, d = 9.5) translate([c, pen_y, sb - ph_sb]) {
  translate([0, 0, ph_grip]) ph_collet(d);
  translate([0, 0, ph_tz0]) ph_sleeve();
}
module c2_pen(c, sb) translate([c, pen_y, sb - ph_sb - ph_stick + 8]) pen();
module c2_assembly(c = c2_c, sb = c2_sb) {
  s = sb < 0 ? c2_sb_touch(ph_stick) : sb;
  color(c_print) frame_base();
  color(c_print) stand_right();
  color(c_print) stand_left();
  color(c_wheel) translate([0, pen_y, wheel_z0]) platter_wheel();
  color("#555") translate([0, pen_y, plate_top]) cylinder(d = disc_d, h = pad_t, $fn = 160);
  color("white") translate([0, pen_y, plate_top + pad_t + 0.05]) cylinder(d = disc_d - 4, h = paper_t, $fn = 160);
  color("#1f5f7a") translate([0, pen_y, plate_top + pad_t + paper_t + 0.1]) clamp_ring();
  color(c_dark) translate([mx, col_y0, belt_z]) rotate([-90, 0, 0]) nema17();
  color(c_metal) translate([mx, rod_y + 4.5, belt_z]) rotate([90, 0, 0]) gt2_16t();
  color(c_metal) for (z = [rod_lo, rod_hi]) translate([-rod_len / 2, rod_y, z]) rotate([0, 90, 0]) cylinder(d = 8, h = rod_len);
  color(c_wheel) translate([-ix, rod_y - 5.075, belt_z]) rotate([-90, 0, 0]) pulley_m3();
  color(c_dark) c2_belt(c);
  color(c_metal) c2_blocks(c);
  color("#3a9d5d") translate([c, 0, 0]) c2_plate();
  color("#e0a020") translate([c, 0, 0]) c2_frame();
  color("#d8d8d0") { c2_stage(c); c2_slider(c, s); }
  color("#7b5cd6") c2_head(c, s);
  color("#e07a35") c2_head_parts(c, s);
  color("#c03030") c2_pen(c, s);
}
// only the carriage, opened up (the pieces pulled forward so each one shows)
module c2_exploded() {
  s = c2_sb_touch(ph_stick);
  color(c_metal) c2_blocks(0);
  color("#3a9d5d") c2_plate();
  color("#d8d8d0") translate([0, -25, 0]) { c2_stage(0); c2_slider(0, s); }
  color("#e0a020") translate([0, -60, 0]) c2_frame();
  color("#7b5cd6") translate([0, -110, 0]) c2_head(0, s);
  color("#e07a35") translate([0, -110, 0]) c2_head_parts(0, s);
}
// pieces for the clash checks (tools: see the report); chk_c / chk_sb set from the command line
chk_a = "";  chk_b = "";  chk_c = 0;  chk_sb = -1;
module c2_mov(n, c, sb) {
  s = sb < 0 ? c2_sb_touch(ph_stick) : sb;
  if (n == "plate") translate([c, 0, 0]) c2_plate();
  if (n == "frame") translate([c, 0, 0]) c2_frame();
  if (n == "blocks") c2_blocks(c);
  if (n == "stage") c2_stage(c);
  if (n == "slider") c2_slider(c, s);
  if (n == "head") c2_head(c, s);
  if (n == "head_parts") c2_head_parts(c, s);
  if (n == "belt") c2_belt(c);
  if (n == "pen") c2_pen(c, s);
}
module c2_fix(n) {
  if (n == "stand_left") stand_left();
  if (n == "stand_right") stand_right();
  if (n == "rods") for (z = [rod_lo, rod_hi]) translate([-rod_len / 2, rod_y, z]) rotate([0, 90, 0]) cylinder(d = 8, h = rod_len);
  if (n == "x_motor") translate([mx, col_y0, belt_z]) rotate([-90, 0, 0]) nema17();
  if (n == "x_pulley") translate([mx, rod_y + 4.5, belt_z]) rotate([90, 0, 0]) gt2_16t();
  if (n == "idler") translate([-ix, rod_y - 5.075, belt_z]) rotate([-90, 0, 0]) pulley_m3();
  if (n == "wheel") translate([0, pen_y, wheel_z0]) platter_wheel();
  if (n == "ring") translate([0, pen_y, plate_top + pad_t + paper_t + 0.1]) clamp_ring();
  if (n == "paper") translate([0, pen_y, plate_top]) cylinder(d = disc_d, h = pad_t + paper_t, $fn = 160);
  if (n == "tray_zone") translate([-200, 44, c2_top + 1]) cube([400, 32, 30]);   // I2
  if (n == "i4_strip") translate([120, -8, 4]) cube([16, 13, 106]);              // I4
}

// ======================= fit-test coupons (I7), each about 10 minutes =======================
// 1. one SC8UU's corner of the plate: pegs, the lower jaw and barb, the middle block's face.
//    (the stage pocket is filled in here: cut in half, its roof would print in mid-air)
module c2_fit_sc8uu() intersection() {
  union() { c2_plate(); translate([-pk_x - 0.01, c2_y0, pk_z0 - 0.01]) cube([2 * pk_x + 0.02, st_back - c2_y0 + 0.01, pk_z1 - pk_z0]); }
  translate([0, 0, c2_z0 - 1]) cube([30, 60, lo_top + 2.2 - c2_z0]);   // tops out below the belt peg's cap (z 118)
}
// 2. bottom 20 mm of the plate (pocket end + both windows) and of the frame (strap + 2 fingers):
//    put the stage's bottom end in, push the frame piece on, it should click and hold the stage.
module c2_fit_stage_plate() intersection() { c2_plate(); translate([-40, 0, c2_z0 - 1]) cube([80, 60, 100.5 - c2_z0]); }
module c2_fit_stage_frame() intersection() { c2_frame(); translate([-40, 0, 0]) cube([80, 60, 100.5]); }
// 3. the slider cap alone: push it on the slider, it should hold by itself and come off by hand.
module ph_fit_cap() intersection() { ph_body(); translate([-30, 0, ph_fz0 - 3]) cube([60, 60, 40]); }
// 4. the housing's threaded ring: the sleeve should screw in by hand all the way, with no wobble.
module ph_fit_thread() intersection() { translate([0, pen_y, 0]) ph_housing(); translate([-20, -20, ph_tz0 - 1]) cube([40, 40, 20]); }

// ======================= print orientations =======================
module c2_plate_print()  translate([0, 0, -c2_y0]) rotate([90, 0, 0]) c2_plate();     // front face down
module c2_frame_print()  translate([0, 0, -fr_y0]) rotate([90, 0, 0]) c2_frame();     // front face down
module ph_body_print()   translate([0, -pen_y, 0]) ph_body();                          // upright
module ph_sleeve_print() translate([0, 0, ph_tz1 - ph_tz0 + ph_skh]) rotate([180, 0, 0]) ph_sleeve();   // knurl down
module ph_collet_print(d) translate([0, 0, ph_lc]) rotate([180, 0, 0]) ph_collet(d);  // wide end down

if (part == "c2_assembly")  c2_assembly();
if (part == "c2_exploded")  c2_exploded();
if (part == "c2_plate")     c2_plate_print();
if (part == "c2_frame")     c2_frame_print();
if (part == "ph_body")      ph_body_print();
if (part == "ph_sleeve")    ph_sleeve_print();
if (part == "ph_collet")    ph_collet_print(ph_pens[collet_i]);
collet_i = 0;
if (part == "c2_fit_sc8uu")        translate([0, 0, -c2_y0]) rotate([90, 0, 0]) c2_fit_sc8uu();
if (part == "c2_fit_stage_plate")  translate([0, 0, -c2_y0]) rotate([90, 0, 0]) c2_fit_stage_plate();
if (part == "c2_fit_stage_frame")  translate([0, 0, -fr_y0]) rotate([90, 0, 0]) c2_fit_stage_frame();
if (part == "ph_fit_cap")          translate([0, 0, -(ph_fz0 - 3)]) translate([0, -pen_y, 0]) ph_fit_cap();
if (part == "ph_fit_thread")       translate([0, -pen_y, -(ph_tz0 - 1)]) ph_fit_thread();
if (part == "chk")  intersection() { c2_mov(chk_a, chk_c, chk_sb); c2_fix(chk_b); }
if (part == "chk2") intersection() { c2_mov(chk_a, chk_c, chk_sb); c2_mov(chk_b, chk_c, chk_sb); }
if (part == "mov")  c2_mov(chk_a, chk_c, chk_sb);
if (part == "fix")  c2_fix(chk_b);
// world-placed single pieces (for picture renders)
if (part == "w_plate") c2_plate();
if (part == "w_frame") c2_frame();
if (part == "w_head")  ph_body();

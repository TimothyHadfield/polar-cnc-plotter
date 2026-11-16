// Platter gear reduction (design only, NOT printed; progress.md D11). 2026-11-15.
// Tim: "could you design the gear reduction more specifically, especially with the specific length
// belt I got ... for the original belt reduction ... Also, the artifact says the platter is the same
// hight as before, but It looks much higher up. Are you sure it's the same hight? Also the design has
// 2 bearings. Would it be much worse if we only used 1? I was hoping maybe we could use the 1 I have
// left from the other order with the 1 remaining bearing from the carraige belt bearing before?"
//
// What it is:
// - The wheel no longer sits on the motor shaft. It spins on a FIXED 3 mm axle (one of Tim's 3 x 100
//   stainless pen-lift rods, cut to ax_len) standing in a printed post. The "bearings" are Tim's two
//   spare GT2 20T idlers (3 mm bore, ball bearings inside), pressed into a pocket in the wheel's hub.
// - 60 GT2 teeth are printed onto the wheel's hub (a ring hanging under the wheel). The platter motor
//   moves C mm off centre with a spare aluminium 16T pulley (Tim has 5, one is on the X motor), and
//   one of his two 220 mm closed loops joins them: 60 / 16 = 3.75 : 1.
// - The motor does NOT fit under the wheel standing on the base: its 23.5 mm shaft would end 7.5 mm
//   above the wheel's underside. So it hangs from a roof with its body through a window in the base
//   (bottom 1 mm above the table), and the wheel's six ribs are notched in a ring where the pulley
//   and shaft tip pass under them. The wheel itself stays at today's real height (W below).
// - Post + motor cage are one printed "drive sled" (its roof is a separate flat print) that slides
//   front-back on the base like today's cage (puts the platter centre under the pen), held by 4 M3x8
//   + nuts. The motor slides along x in the roof's slots to tension the belt (same 4 screws +
//   washers as today).
//
// Parts: gr_base (replaces frame_base), gr_sled, gr_roof, gr_wheel (replaces platter_wheel; clamp ring, stands,
// carriage unchanged). Bought/owned: 2 idlers, 1 16T pulley, 1 220 mm loop, 1 3 mm rod, 4 M3x8 + nuts.
//
// openscad -D 'part="gr_wheel"' cad/gear-reduction.scad   (parts: see the list at the bottom)

include <printed-frame.scad>
part = "gr_assembly";

// ---------- ASSUMED sizes of bought parts: measure before printing ----------
idl_h  = 8.5;     // idler height (B08J9W4PJT listing; same number as idler_w in printed-frame.scad)
idl_fd = 18;      // ASSUMED, measure: idler flange diameter (typical for 20T 3 mm idlers)
idl_td = 12.2;    // ASSUMED: idler tooth diameter (drawing only)
idl_n  = 2;       // idlers stacked in the hub: 2 (Tim's two). 1 works (see the artifact: ~3x the wobble)
p16_fd = 16;  p16_h = 16;   // aluminium 16T pulley: flange, 7 teeth, flange, 7 hub (plotter-assembly gt2_16t)
belt_w = 6;       // ASSUMED: listed 6 mm, sold as "220-2GT-9" (9 mm?). A 9 mm belt does not fit the 16T
belt_L = 220;     // Tim's closed loop: 110 teeth
ax_d   = 3;       // 304 stainless rod, 3 x 100 (Tim has 5)

// ---------- ratio and centre distance ----------
n_ring = 60;  n_pul = 16;
pd = function(n) n * 2 / PI;                       // pitch diameter, GT2 2 mm
A_ = belt_L - PI * (pd(n_ring) + pd(n_pul)) / 2;
C  = (A_ + sqrt(A_ * A_ - 2 * pow(pd(n_ring) - pd(n_pul), 2))) / 4;   // 70.6 (L = 2C + pi(D+d)/2 + (D-d)^2/4C)
ratio = n_ring / n_pul;                            // 3.75
A20 = belt_L - PI * (pd(n_ring) + pd(20)) / 2;     // the same loop with a 20T pulley (a 9 mm belt): 68.8
C20 = (A20 + sqrt(A20 * A20 - 2 * pow(pd(n_ring) - pd(20), 2))) / 4;

// ---------- heights (world z, base top = 0) ----------
W        = wheel_z0 + raise;      // 49.0: the wheel's underside today (collar 3 puts it 4.5 over the cage)
mot_bot  = -base_t + 1;           // -5: motor body 1 mm above the table, through the base window
mface    = mot_bot + motor_len;   // 33: motor face
roof_t   = 6;                     // same roof as today's cage: boss channel 3, screw heads sunk 3.5
roof_top = mface + roof_t;        // 39
pul_z    = roof_top + 0.5;        // 39.5: pulley's lower flange (hub UP)
zb       = pul_z + 1 + 3.5;       // 44: belt centre
tip_z    = mface + shaft_len;     // 56.5: shaft tip
notch_z  = tip_z + 1.5;           // 58: ribs notched up to here, r = C +- notch_r
notch_r  = p16_fd / 2 + 1;
sled_t   = 4;                     // sled plate on the base top
ring_bot = zb - 3.5 - 1.6 - 0.4;  // 38.5: bottom of the 60T ring's lower flange
pk_d     = idl_fd + 0.2;          // idler pocket (printed holes come out ~0.1-0.2 small: press fit)
pk_top   = ring_bot + 0.5 + idl_n * idl_h;   // 56 (2 idlers): pocket ceiling, the idlers press up to it
idl_z0   = pk_top - idl_n * idl_h;           // 39: lower idler's underside
post_top = ring_bot - 1;          // 37.5: 1 mm under the ring
ax_bot   = sled_t - 3;            // rod sits in a blind hole, 1 mm of floor under it ... (sled z 0..4)
ax_top   = pk_top + 0.5;
ax_len   = ax_top - ax_bot;       // 55.5 -> cut the 100 mm rod to ~55.5
gr_hub_d = 46;                    // wheel hub widened so the 60T ring's flange sits on solid hub
sy       = pen_y;                 // sled y in this model (it slides cage_y +- motor_adj like today)

echo(str("GR: C=", C, " ratio=", ratio, " W=", W, " zb=", zb, " tip=", tip_z, " ring_bot=", ring_bot,
         " idl_z0=", idl_z0, " pk_top=", pk_top, " ax_len=", ax_len, " $101(1/8)=", 1600 * ratio / 360));

// ---------- wheel: today's platter_wheel + solid hub + 60T ring + idler pocket + rib notches ----------
// Wheel coordinates: z 0 = underside (world W).
module ring60() {
  zt = zb - W - 3.5;                               // teeth bottom
  translate([0, 0, zt]) gt2_toothed(n_ring, 7);
  translate([0, 0, zt + 7 - 0.01]) cylinder(d = 44, h = -zt - 7 + 0.02);           // upper flange, into the hub
  od = n_ring * 2 / PI - 2 * gt2_plo;
  translate([0, 0, zt - 1.6]) cylinder(d1 = od + 3.2, d2 = od, h = 1.6 + 0.01);     // lower flange, 45 deg (prints)
  translate([0, 0, ring_bot - W]) cylinder(d = od + 3.2, h = zt - 1.6 - (ring_bot - W) + 0.01);
}
module gr_wheel() difference() {
  union() {
    difference() {
      platter_wheel();
      translate([0, 0, -1]) difference() {                                         // rib notches
        cylinder(r = C + notch_r, h = notch_z - W + 1, $fn = 180);
        translate([0, 0, -1]) cylinder(r = C - notch_r, h = notch_z - W + 3, $fn = 180);
      }
    }
    cylinder(d = gr_hub_d, h = w_h + disc_t - 0.01, $fn = 96);                     // fills the collar socket
    ring60();
  }
  translate([0, 0, ring_bot - W - 1]) cylinder(d = pk_d, h = pk_top - ring_bot + 1, $fn = 96);   // idlers
  translate([0, 0, ring_bot - W - 1]) cylinder(d1 = pk_d + 2, d2 = pk_d, h = 1.5, $fn = 96);     // lead-in
  translate([0, 0, pk_top - W - 0.01]) cylinder(d = ax_d + 1.5, h = 2.5, $fn = 32);              // rod tip room
}

// ---------- drive sled: post + motor roof, one print, flat on the base top ----------
sl_x0 = -C - motor_w / 2 - 6;      // left end (-97.8)
sl_x1 = 24;
sl_hw = motor_w / 2 + motor_fit + 3 + 2.5;   // half width in y (27.6)
ten   = 3;                          // belt tension travel each way (motor slides along x)
win_hx = motor_w / 2 + motor_fit + ten;   // motor window half size in x
in_y   = motor_w / 2 + motor_fit;          // walls' inner faces
scr_x  = [12, -34];                 // sled screws (x), at y +-20: slots +-motor_adj in the base's nuts
wall_t = 5;                         // walls 5 thick so a 3 mm pin fits on top
pin_x  = [-20, 20];                 // roof pins (x from the motor's middle position)
// The roof is a SEPARATE flat print (first slice 11-16: printed in one piece, the roof is a 49 mm
// bridge full of holes and Bambu filled the whole cage with support). It sits on the walls' tops:
// the motor hangs from it, so its weight presses the roof down; two pins per wall stop the belt
// pulling it sideways. Printed top face down: the sunk heads are then pockets on the bed.
module gr_sled() difference() {
  union() {
    translate([sl_x0, -sl_hw, 0]) cube([sl_x1 - sl_x0, 2 * sl_hw, sled_t]);                // plate
    for (s = [-1, 1]) translate([-C - win_hx - 2.5, s > 0 ? in_y : -in_y - wall_t, 0]) {   // two walls
      cube([2 * win_hx + 5, wall_t, mface]);
      for (x = pin_x) translate([win_hx + 2.5 + x, wall_t / 2, mface - 0.01]) cylinder(d = 3, h = 3, $fn = 24);
    }
    cylinder(d1 = 40, d2 = 16, h = post_top, $fn = 96);                                      // post
    translate([0, 0, post_top - 0.01]) cylinder(d = 5.2, h = idl_z0 - post_top + 0.01, $fn = 32);   // inner-race boss
  }
  translate([-C - win_hx, -in_y, -1]) cube([2 * win_hx, 2 * in_y, mface + 1]);              // motor window
  translate([0, 0, ax_bot]) cylinder(d = ax_d + 0.1, h = 100, $fn = 32);                     // rod: press fit
  for (x = scr_x, s = [-1, 1]) translate([x, s * 20, 0]) {                                   // sled screws
    translate([0, 0, -1]) cylinder(d = 3.4, h = sled_t + 2, $fn = 24);
    translate([0, 0, 2]) cylinder(d = 6.5, h = sled_t, $fn = 24);                             // head counterbore
  }
}
// motor roof (world position): shaft + boss slot, screw slots, sunk heads (all slide +-ten along x)
module gr_roof() difference() {
  translate([-C - win_hx - 2.5, -in_y - wall_t, mface]) cube([2 * win_hx + 5, 2 * (in_y + wall_t), roof_t]);
  for (s = [-1, 1], x = pin_x) translate([-C + x, s * (in_y + wall_t / 2), mface - 1]) cylinder(d = 3.4, h = 4 + 1, $fn = 24);
  translate([-C, 0, 0]) {
    hull() for (x = [-ten, ten]) translate([x, 0, mface - 1]) cylinder(d = 8, h = roof_t + 2);
    hull() for (x = [-ten, ten]) translate([x, 0, mface - 1]) cylinder(d = 23.5, h = 3 + 1);
    for (sx = [-1, 1], sy2 = [-1, 1]) translate([sx * 15.5, sy2 * 15.5, 0]) hull() for (x = [-ten, ten]) translate([x, 0, 0]) {
      translate([0, 0, mface - 1]) cylinder(d = 3.4, h = roof_t + 2, $fn = 24);
      translate([0, 0, roof_top - 3.5]) cylinder(d = 6.5, h = 4, $fn = 24);
    }
  }
}

// ---------- base: today's base without the cage, + motor window, + nut slots for the sled ----------
module gr_base() difference() {
  union() {
    translate([-lap_x, base_y0, -base_t]) cube([2 * lap_x, base_y1 - base_y0, base_t]);
    for (s = [-1, 1]) mirror([s < 0 ? 1 : 0, 0, 0]) {
      translate([lap_x - 0.01, base_y0, -base_t]) cube([base_x - lap_x + 0.01, base_y1 - base_y0, lap_low]);
      along_y(base_y0, base_y1 - dt_stop) dt_profile();
    }
    tray();
  }
  // the motor window: the motor's body at every sled position (y) and belt tension (x). 11-16: it also
  // covers C20 (a printed 20T pulley, if Tim's "220-2GT-9" loop turns out 9 mm wide), so this base
  // fits either drive; only the sled, roof and wheel change with the belt.
  translate([-C - win_hx - 0.5, cage_y - motor_adj - in_y - 0.5, -base_t - 1])
    cube([2 * win_hx + 1 + (C - C20), 2 * (motor_adj + in_y) + 1, base_t + 2]);
  // sled screws: slots through, hex nut slots from underneath (the nut slides with the screw)
  for (x = scr_x, s = [-1, 1]) translate([x, cage_y + s * 20, 0]) {
    translate([0, 0, -base_t - 1]) obround(3.4, base_t + 2, motor_adj);
    translate([0, 0, -base_t - 0.01]) hull() for (y = [-motor_adj, motor_adj]) translate([0, y, 0]) rotate(30) cylinder(d = 6.6, h = 2.6, $fn = 6);
  }
}

// ---------- bought parts (drawing only) ----------
module idler() difference() {
  union() {
    cylinder(d = idl_fd, h = 1, $fn = 48);
    translate([0, 0, 1]) cylinder(d = idl_td, h = idl_h - 2, $fn = 40);
    translate([0, 0, idl_h - 1]) cylinder(d = idl_fd, h = 1, $fn = 48);
  }
  translate([0, 0, -1]) cylinder(d = ax_d, h = idl_h + 2, $fn = 16);
}
module belt() translate([0, 0, zb - belt_w / 2]) linear_extrude(belt_w) difference() {
  offset(r = 1.1) hull() { circle(d = pd(n_ring), $fn = 96); translate([-C, 0]) circle(d = pd(n_pul), $fn = 48); }
  offset(r = -0.3) hull() { circle(d = pd(n_ring), $fn = 96); translate([-C, 0]) circle(d = pd(n_pul), $fn = 48); }
}
module gr_motor() translate([-C, 0, mface]) rotate(90) nema17(shaft_len);     // plug faces -x (outboard)
module gr_pulley() translate([-C, 0, pul_z]) gt2_16t();
module gr_idlers() for (i = [0 : idl_n - 1]) translate([0, 0, idl_z0 + i * idl_h]) idler();
module gr_axle() translate([0, 0, ax_bot]) cylinder(d = ax_d, h = ax_len, $fn = 16);

// ---------- assembly (sled at the model's pen line) ----------
c_new = "#e07a35";
module gr_assembly() {
  color(c_print) gr_base();
  translate([0, sy, 0]) {
    color(c_new) gr_sled();
    color(c_new) gr_roof();
    color(c_wheel) translate([0, 0, W]) gr_wheel();
    color(c_dark) gr_motor();
    color(c_metal) gr_pulley();
    color("#202020") belt();
    color("#c9ccd0") gr_idlers();
    color(c_metal) gr_axle();
  }
}

// ---------- clash checks: each must render EMPTY ("Current top level object is empty") ----------
// The notch is a full ring (r = C +- notch_r), so the worst case is a rib straight over the pulley:
// rotate(30) puts the rib at 150 deg onto 180 (the motor's side). Plus rotate(0) for the belt runs.
module wheel_swept() for (a = [0, 30]) rotate(a) translate([0, 0, W]) gr_wheel();
module chk_wheel_pulley() intersection() { wheel_swept(); translate([-C - 12, -12, 30]) cube([24, 24, 30]);
                                           union() { gr_motor(); gr_pulley(); } }
module chk_wheel_belt()   intersection() { wheel_swept(); belt(); }
module chk_wheel_sled()   intersection() { wheel_swept(); union() { gr_sled(); gr_roof(); } }
module chk_sled_belt()    intersection() { union() { gr_sled(); gr_roof(); } belt(); }
module chk_roof_sled()    intersection() { gr_roof(); gr_sled(); }   // only the 4 pins in their holes: must be EMPTY (0.2 clearance)
module chk_motor_sled()   intersection() { union() { gr_sled(); gr_roof(); } for (x = [-ten, 0, ten]) translate([x, 0, 0]) gr_motor(); }
module chk_motor_base()   intersection() { gr_base(); for (y = [-motor_adj, 0, motor_adj], x = [-ten, ten])
                                              translate([x, cage_y + y, 0]) gr_motor(); }
module chk_idler_wheel()  intersection() { translate([0, 0, W]) gr_wheel(); gr_idlers(); }   // press fit only: tiny
module chk_sled_stand()   intersection() { stand_left(); for (y = [-motor_adj, motor_adj]) translate([0, cage_y + y, 0]) gr_sled(); }

// print orientations
module print_gr_wheel() translate([0, 0, w_h + disc_t]) rotate([180, 0, 0]) gr_wheel();   // platter face on the bed
module print_gr_sled()  gr_sled();
module print_gr_roof()  translate([0, 0, roof_top]) rotate([180, 0, 0]) gr_roof();   // top face on the bed
module print_gr_base()  translate([0, 0, base_t]) gr_base();

if (part == "gr_assembly")      gr_assembly();
if (part == "gr_wheel")         gr_wheel();
if (part == "gr_sled")          gr_sled();
if (part == "gr_roof")          gr_roof();
if (part == "print_gr_roof")    print_gr_roof();
if (part == "chk_roof_sled")    chk_roof_sled();
if (part == "gr_base")          gr_base();
if (part == "print_gr_wheel")   print_gr_wheel();
if (part == "print_gr_sled")    print_gr_sled();
if (part == "print_gr_base")    print_gr_base();
if (part == "gr_motor")         gr_motor();
if (part == "gr_pulley")        gr_pulley();
if (part == "gr_belt")          belt();
if (part == "gr_idlers")        gr_idlers();
if (part == "gr_axle")          gr_axle();
if (part == "chk_wheel_pulley") chk_wheel_pulley();
if (part == "chk_wheel_belt")   chk_wheel_belt();
if (part == "chk_wheel_sled")   chk_wheel_sled();
if (part == "chk_sled_belt")    chk_sled_belt();
if (part == "chk_motor_sled")   chk_motor_sled();
if (part == "chk_motor_base")   chk_motor_base();
if (part == "chk_idler_wheel")  chk_idler_wheel();
if (part == "chk_sled_stand")   chk_sled_stand();

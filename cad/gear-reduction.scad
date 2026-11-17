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
idl_fd = 18;      // listing (Tim 11-16: "outer diameter: 18mm ... Just trust these measurements")
idl_td = 12.2;    // ASSUMED: idler tooth diameter (drawing only; listing: tooth width 6.5 = flanges 1 mm)
idl_n  = 2;       // pocket depth = 2 idlers. Tim has ONE spare (11-16): the lower slot gets the real
                  // idler (its inner race sits on the boss and carries the wheel), the upper slot a
                  // printed stand-in (gr_standin) until he buys a 2nd; a centre hole lets him push it out.
p16_fd = 16;  p16_h = 16;   // aluminium 16T pulley: flange, 7 teeth, flange, 7 hub (plotter-assembly gt2_16t)
belt_w = 6;       // ASSUMED: listed 6 mm, sold as "220-2GT-9" (9 mm?). A 9 mm belt does not fit the 16T
belt_L = 220;     // Tim's closed loop: 110 teeth
ax_d   = 3;       // 304 stainless rod, 3 x 100 (Tim has 5)
si_fd  = idl_fd - 0.05;   // stand-in OD (printed ODs come out ~0.1 big: same press as the real idler)
si_h   = idl_h - 0.1;
si_bore = ax_d + 0.4;     // prints ~3.2: slides on the 3 mm rod (a 3.1 hole printed too tight on sled 1)
push_d = 6.5;             // push-out hole through the platter face (under the pad), for a screwdriver
gt2_plo = 0.254;          // copy of plotter-parts.scad's value: `use` doesn't import variables (before
                          // 11-16 it was undefined here and the 60T ring's lower flange silently vanished)

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
// 11-16, Tim: "I don't want the motor to fall through when I lift it up ... no solid holes through
// the base plate". The window is now a pocket with a floor_t floor. The motor still hangs from the
// roof (its 4 screws), so the floor carries nothing; its back screw heads (0.6 proud) stand 0.4 over
// it. Everything above moves up 1.2 mm with it: belt, ring, idlers, notch, axle.
floor_t  = 1.2;                   // pocket floor (6 layers)
mot_bot  = -base_t + floor_t + 1.0;   // -3.8: motor body 1.0 above the pocket floor
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
  translate([0, 0, pk_top - W - 0.01]) cylinder(d = push_d, h = 40, $fn = 32);   // rod tip room + push-out hole
}
// Stand-in for the missing 2nd idler: a plastic bushing the idler's size, pressed in FIRST (up to the
// ceiling). It turns with the wheel and slides on the rod. Its lower face is relieved so it never
// rubs the real idler's inner race (that race stands still). Printed relief-side up.
module gr_standin() difference() {
  union() {
    cylinder(d1 = si_fd - 1, d2 = si_fd, h = 0.5, $fn = 96);                 // lead-in (bed side = top when fitted)
    translate([0, 0, 0.5 - 0.01]) cylinder(d = si_fd, h = si_h - 0.5, $fn = 96);
  }
  translate([0, 0, -1]) cylinder(d = si_bore, h = si_h + 2, $fn = 32);
  translate([0, 0, si_h - 0.6]) cylinder(d = 9, h = 1, $fn = 48);              // inner-race relief
}
module print_plate14() { print_gr_wheel(); translate([110, -110, 0]) gr_standin(); }

// ---------- drive sled: post + motor roof, one print, flat on the base top ----------
// Sled 2 (11-16, after Tim printed sled 1): "the steel rod ... doesn't fit at all into the hole in the
// cone" (3.1 hole printed small) -> 3.3. "the little bar at the bottom blocks the cord ... It would be
// much better if the opening was truely open (even with the lid on), and pointed to the back of the
// base plate." -> walls on the front, outer (-x) and wheel (+x) sides only; the BACK (+y) is open
// from the base pocket up to the roof, and the plate under it is cut away to the back edge. Mount
// the motor with its plug pointing back (the 4 screws allow any of 4 turns).
ten    = 3;                         // belt tension travel each way (motor slides along x)
win_hx = motor_w / 2 + motor_fit + ten;   // motor window half size in x
in_y   = motor_w / 2 + motor_fit;          // motor body clearance in y
wall_t = 5;                         // front and wheel-side walls (3 mm pins on top)
wall_o = 4;                         // outer (-x) wall: no pins, keeps the sled 1.1 clear of the left stand
sl_x0 = -C - win_hx - wall_o;       // left end (-99.2)
sl_x1 = 24;
sl_hw = motor_w / 2 + motor_fit + 3 + 2.5;   // plate half width in y (27.6)
cx0 = sl_x0;  cx1 = -C + win_hx + wall_t;   // cage x extent
cy0 = -in_y - wall_t;  cy1 = in_y;          // cage y extent (back open at in_y)
scr_x  = [12, -34];                 // sled screws (x), at y +-20: slots +-motor_adj in the base's nuts
pins   = [[-C - 20, -in_y - wall_t / 2], [-C + 20, -in_y - wall_t / 2],          // front wall
          [-C + win_hx + wall_t / 2, -12], [-C + win_hx + wall_t / 2, 12]];      // wheel-side wall
// The roof is a SEPARATE flat print (first slice 11-16: printed in one piece, the roof is a 49 mm
// bridge full of holes and Bambu filled the whole cage with support). It sits on the walls' tops:
// the motor hangs from it, so its weight presses the roof down; 4 pins stop the belt pulling it
// sideways. Printed top face down: the sunk heads are then pockets on the bed.
module gr_sled() difference() {
  union() {
    translate([sl_x0, -sl_hw, 0]) cube([sl_x1 - sl_x0, 2 * sl_hw, sled_t]);                // plate
    translate([cx0, cy0, 0]) cube([cx1 - cx0, wall_t, mface]);                               // front wall
    translate([cx0, cy0, 0]) cube([wall_o, cy1 - cy0, mface]);                               // outer wall
    translate([cx1 - wall_t, cy0, 0]) cube([wall_t, cy1 - cy0, mface]);                      // wheel-side wall
    for (p = pins) translate([p[0], p[1], mface - 0.01]) cylinder(d = 3, h = 3, $fn = 24);
    cylinder(d1 = 40, d2 = 16, h = post_top, $fn = 96);                                      // post
    translate([0, 0, post_top - 0.01]) cylinder(d = 5.2, h = idl_z0 - post_top + 0.01, $fn = 32);   // inner-race boss
  }
  translate([-C - win_hx, -in_y, -1]) cube([2 * win_hx, sl_hw + in_y + 1, mface + 2]);      // motor window, open to the back
  translate([sl_x0 - 1, cy1, -1]) cube([wall_o + 1, sl_hw, sled_t + 2]);                    // no plate stub behind the outer wall
  translate([0, 0, ax_bot]) cylinder(d = ax_d + 0.3, h = 100, $fn = 32);                     // rod: 3.3 prints ~3.1 (3.1 was too tight)
  for (x = scr_x, s = [-1, 1]) translate([x, s * 20, 0]) {                                   // sled screws
    translate([0, 0, -1]) cylinder(d = 3.4, h = sled_t + 2, $fn = 24);
    translate([0, 0, 2]) cylinder(d = 6.5, h = sled_t, $fn = 24);                             // head counterbore
  }
}
// motor roof (world position): shaft + boss slot, screw slots, sunk heads (all slide +-ten along x)
module gr_roof() difference() {
  translate([cx0, cy0, mface]) cube([cx1 - cx0, cy1 - cy0, roof_t]);
  for (p = pins) translate([p[0], p[1], mface - 1]) cylinder(d = 3.4, h = 4 + 1, $fn = 24);
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
  translate([-C - win_hx - 0.5, cage_y - motor_adj - in_y - 0.5, -base_t + floor_t])
    cube([2 * win_hx + 1 + (C - C20), 2 * (motor_adj + in_y) + 1, base_t]);   // pocket, floored
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
module gr_motor() translate([-C, 0, mface]) nema17(shaft_len);     // plug faces +y (the open back, sled 2)
// Printed M3 nuts (Tim has 1 real nut): fit the base's hex slots; the M3 screw cuts its own thread.
// They only locate the sled: belt pull and platter torque stay inside the sled (motor + axle on it).
module gr_nut() difference() { rotate(30) cylinder(d = 6.3, h = 2.4, $fn = 6); translate([0, 0, -1]) cylinder(d = 2.5, h = 5, $fn = 20); }
module print_plate13() { print_gr_sled(); translate([0, 75, 0]) print_gr_roof();
                         for (x = [8, 18], y = [42, 52]) translate([x, y, 0]) gr_nut(); }
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
if (part == "gr_standin")       gr_standin();
if (part == "print_plate13")    print_plate13();
if (part == "print_plate14")    print_plate14();
if (part == "chk_standin_wheel") intersection() { translate([0, 0, W]) gr_wheel(); translate([0, 0, idl_z0 + idl_h]) translate([0, 0, si_h]) rotate([180, 0, 0]) gr_standin(); }
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

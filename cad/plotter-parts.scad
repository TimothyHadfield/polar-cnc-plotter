// Polar plotter printed parts, redrawn from Tim's TinkerCad export "Polar Potter Custom.stl".
// All sizes in mm. Each part is a module built at its own origin; the bottom of this file lays
// them out exactly where they sat on the TinkerCad print plate.
// Show one part only: set `part` below (or run openscad -D 'part="clip"').

part = "all";   // all, motor_plate, base_plate, motor_plate_2, big_pulley, spool, bracket, clip,
                // pulley_a, pulley_b, gear, platter_hub, motor_stand,
                // big_pulley_gt2, pulley_m3, idler_washer, paper_ring

$fn = 96;
screw_d = 3.4;      // M3 clearance hole. The TinkerCad parts used 3.0, which usually prints too tight.
nema_pitch = 31;    // NEMA 17 screw spacing

module nema_screws(h, d = screw_d) {
  for (sx = [-1, 1], sy = [-1, 1])
    translate([sx * nema_pitch / 2, sy * nema_pitch / 2, -1]) cylinder(d = d, h = h + 2);
}

// One tooth's radius profile repeated n times (measured from the TinkerCad parts).
module toothed(n, prof, h) {
  k = len(prof);
  linear_extrude(h) polygon([for (i = [0 : n * k - 1])
    let(a = 360 * i / (n * k), r = prof[i % k]) [r * cos(a), r * sin(a)]]);
}

// ---------- motor plate: 120 x 73 x 2, NEMA 17 mount near one end ----------
// The motor side (top here, underside on the machine) gets a 1 mm pad the size of the motor face so
// the deeper recess still leaves a 1 mm floor. The motor face sits flat on the pad across all four
// screws; the outline, holes and the flat print-bed face are unchanged. Screws: 1 mm longer than before.
mp_recess = 2;      // recess depth for the motor's round boss (NEMA 17: ~2 mm tall, 22 wide). Was 1 (too shallow, Tim)
mp_pad = 1;         // extra thickness under the motor face (42 x 42, trimmed to the plate outline)
module motor_plate() {
  t = 2;
  difference() {
    union() {
      cube([120, 73, t]);
      intersection() {
        translate([20 - 21, 36.5 - 21, 0]) cube([42, 42, t + mp_pad]);
        cube([120, 73, t + mp_pad]);
      }
    }
    translate([20, 36.5, 0]) {
      translate([0, 0, -1]) cylinder(d = 10, h = t + mp_pad + 2);                 // shaft
      translate([0, 0, t + mp_pad - mp_recess]) cylinder(d = 25, h = mp_recess + 1);  // recess for the motor boss
      nema_screws(t + mp_pad);
    }
  }
}

// ---------- base plate: 57 x 95 plate, raised block, two capped pegs ----------
// The flat face (z = 0, on the print bed) carries the micro linear stage (pen lift). A shallow
// pocket the stage's white base drops into, so it sits square and centred (Tim, 2026-10-26).
// The plate is 1 mm thicker on that face so the pocket doesn't leave a thin skin.
// Measure the stage base with calipers before printing; listing size is 81.3 x 24.9.
cap_gap = 0;   // TinkerCad had the caps floating 0.33 mm above the pegs (they would print in mid-air)
stage_len = 81.3;     // stage base, along the plate's 95 mm side
stage_wid = 24.9;
stage_fit = 0.3;      // clearance each side
pocket_d  = 1.5;      // pocket depth
plate_add = 1;        // extra thickness on the stage face
module base_plate() {
  difference() {
    union() {
      translate([0, 0, -plate_add]) cube([57, 95, 2 + plate_add]);
      translate([0, 35, 0]) cube([57, 25, 8.17]);
      for (x = [9, 48]) translate([x, 55, 0]) {
        cylinder(d = 6.4, h = 17.67);
        translate([0, 0, 17.67 + cap_gap]) cylinder(d = 10, h = 2);
      }
    }
    translate([(57 - stage_wid) / 2 - stage_fit, (95 - stage_len) / 2 - stage_fit, -plate_add - 1])
      cube([stage_wid + 2 * stage_fit, stage_len + 2 * stage_fit, pocket_d + 1]);
  }
}

// ---------- second motor plate: 3 mm, stepped outline, screw heads sunk from below ----------
module motor_plate_2() {
  t = 3;
  difference() {
    linear_extrude(t) polygon([[15.73, 82], [15.73, 63.25], [0, 63.25], [0, 18.8], [15.73, 18.8],
                               [15.73, 0], [60.73, 0], [60.73, 82]]);
    translate([22.23, 41, 0]) {
      translate([0, 0, -1]) cylinder(d = 10, h = t + 2);           // shaft
      translate([0, 0, 1]) cylinder(d = 25, h = t);                // 2 mm recess for the motor collar
      nema_screws(t);
      for (sx = [-1, 1], sy = [-1, 1])                             // 1.5 mm counterbores underneath
        translate([sx * nema_pitch / 2, sy * nema_pitch / 2, -1]) cylinder(d = 6.4, h = 2.5);
    }
    for (y = [9.5, 72.5]) translate([38.22, y, -1]) cylinder(d = 4.77, h = t + 2);
  }
}

// ---------- big pulley: 60 teeth, 44 mm flanges, 27.9 mm bore ----------
big_pulley_tooth = [18.994, 19.003, 19.047, 19.140, 19.385, 19.783, 19.913, 19.976,
                    20.000, 19.991, 19.943, 19.843, 19.559, 19.197, 19.075, 19.016];
module big_pulley() {
  f = 1.58;
  difference() {
    union() {
      cylinder(d = 44, h = f);
      translate([0, 0, f]) toothed(60, big_pulley_tooth, 10 - 2 * f);
      translate([0, 0, 10 - f]) cylinder(d = 44, h = f);
    }
    translate([0, 0, -1]) cylinder(d = 27.9, h = 12);
  }
}

// ---------- big pulley, true GT2: 60 teeth on a 2.00 mm pitch, same bore, flanges and height ----------
// The `big_pulley` above has a 2.09 mm tooth spacing, so a GT2 belt rides on its tips (components.md §5).
// GT2 2 mm tooth outline and the tooth placement below are from droftarts' "Parametric Pulley"
// (Thingiverse thing:16627, CC BY-SA 3.0), the generator most OpenSCAD GT2 pulleys come from.
// Outside diameter = teeth x pitch / pi - 2 x 0.254 (pitch line offset) = 37.69 mm for 60 teeth.
gt2_pitch = 2;
gt2_plo = 0.254;              // pitch line offset (belt pitch line sits this far outside the pulley)
gt2_tooth_w = 1.494;          // groove width / depth of droftarts' GT2_2mm outline
gt2_tooth_d = 0.764;
gt2_extra_w = 0.2;            // droftarts' default: groove 0.2 mm wider for printing
module gt2_groove(h) {        // one groove, opening at y = 0, pointing to +y (toward the centre)
  linear_extrude(h) polygon([[0.747183,-0.5],[0.747183,0],[0.647876,0.037218],[0.598311,0.130528],
    [0.578556,0.238423],[0.547158,0.343077],[0.504649,0.443762],[0.451556,0.53975],[0.358229,0.636924],
    [0.2484,0.707276],[0.127259,0.750044],[0,0.76447],[-0.127259,0.750044],[-0.2484,0.707276],
    [-0.358229,0.636924],[-0.451556,0.53975],[-0.504649,0.443762],[-0.547158,0.343077],
    [-0.578556,0.238423],[-0.598311,0.130528],[-0.647876,0.037218],[-0.747183,0],[-0.747183,-0.5]]);
}
module gt2_toothed(n, h) {
  od = n * gt2_pitch / PI - 2 * gt2_plo;
  dist = sqrt(pow(od / 2, 2) - pow((gt2_tooth_w + gt2_extra_w) / 2, 2));
  difference() {
    cylinder(d = od, h = h, $fn = n * 8);
    for (i = [1 : n]) rotate(i * 360 / n) translate([0, -dist, -1])
      scale([(gt2_tooth_w + gt2_extra_w) / gt2_tooth_w, 1, 1]) gt2_groove(h + 2);
  }
}
module big_pulley_gt2() {
  f = 1.58;
  difference() {
    union() {
      cylinder(d = 44, h = f);
      translate([0, 0, f - 0.01]) gt2_toothed(60, 10 - 2 * f + 0.02);   // overlap so it fuses to the flanges
      translate([0, 0, 10 - f]) cylinder(d = 44, h = f);
    }
    translate([0, 0, -1]) cylinder(d = 27.9, h = 12);
  }
}

// ---------- spool / roller: 28 mm flange, 21.3 mm hub, 8 mm bore (four on the plate) ----------
spool_bore = 8.0;   // if this goes on an 8 mm rod or 608 bearing, 8.2-8.3 prints with less force
module spool() {
  difference() {
    union() { cylinder(d = 28, h = 2); cylinder(d = 21.3, h = 17); }
    translate([0, 0, -1]) cylinder(d = spool_bore, h = 19);
  }
}

// ---------- bracket: base with two screw holes, two arched side walls with a 3 mm hole ----------
// Wall outline (length along Y, height Z), measured from the TinkerCad part.
bracket_flare = [[0, 6.2], [0.27, 6.4], [0.95, 6.93], [1.34, 7.27], [2.03, 8.07], [2.73, 8.88],
                 [3.27, 9.82], [3.56, 10.28], [3.96, 11.16], [4.34, 12.21], [4.46, 12.76],
                 [4.81, 13.98], [4.88, 14.53], [4.95, 15.08]];
module bracket_wall_outline() {
  arc = [for (a = [186.5 : -3.5 : -6.5]) [17.5 + 12.5 * cos(a), 16.5 + 12.5 * sin(a)]];
  polygon(concat([[0, 0]], bracket_flare, arc,
                 [for (i = [len(bracket_flare) - 1 : -1 : 0]) [35 - bracket_flare[i][0], bracket_flare[i][1]]],
                 [[35, 0]]));
}
module bracket() {
  base_h = 4.06;
  difference() {
    union() {
      cube([18, 35, base_h]);
      for (x = [0, 16]) translate([x, 0, 0]) rotate([90, 0, 90]) linear_extrude(2) bracket_wall_outline();
      // inside fillets where the walls meet the base
      for (side = [0, 1]) translate([side ? 16 : 2, 0, base_h]) mirror([side, 0, 0])
        difference() {
          cube([1.6, 35, 1.85]);
          translate([1.6, -1, 1.85]) rotate([-90, 0, 0]) scale([1.6, 1.85, 1]) cylinder(r = 1, h = 37);
        }
    }
    for (y = [4.55, 30.45]) translate([9, y, -1]) cylinder(d = 3.1, h = base_h + 2);
    // hole through both walls (drawn 3.1 wide x 3.6 tall)
    translate([-1, 17.5, 17.38]) rotate([0, 90, 0]) scale([3.6 / 3.1, 1, 1]) cylinder(d = 3.1, h = 20);
  }
}

// ---------- clip: C-shaped clamp with a slot and a 3 mm cross hole ----------
module clip() {
  difference() {
    linear_extrude(10) polygon([[20, 15], [20, 20], [0, 20], [0, 17], [17, 17], [17, 3], [0, 3],
                                [0, 0], [20, 0], [20, 5], [23, 5], [23, 15]]);
    translate([19.8, 7, -1]) cube([2.2, 6, 12]);
    translate([16, 10, 5]) rotate([0, 90, 0]) cylinder(d = 3, h = 8);
  }
}

// ---------- small belt pulleys: 20 teeth (GT2 size), 18 mm flanges, 5.15 mm bore ----------
gt2_20_tooth = [5.181, 5.187, 5.224, 5.301, 5.505, 5.856, 5.971, 6.028,
                6.050, 6.041, 5.998, 5.908, 5.654, 5.348, 5.247, 5.198];
// pulley_b vs a true GT2 20T (measured from this profile): tips at radius 6.05 vs 6.11, roots 5.18 vs
// 5.35. Belt pitch circle 39.6 vs 40 mm (1 % short), about 0.2 mm over the 10 teeth in contact: close
// enough, left as is.
module small_pulley(f, h, bore = 5.15, hub = 0, hub_d = 0) {
  difference() {
    union() {
      cylinder(d = 18, h = f);
      translate([0, 0, f]) toothed(20, gt2_20_tooth, h - 2 * f);
      translate([0, 0, h - f]) cylinder(d = 18, h = f);
      if (hub > 0) translate([0, 0, -hub]) cylinder(d = hub_d, h = h + 2 * hub);
    }
    translate([0, 0, -hub - 1]) cylinder(d = bore, h = h + 2 * hub + 2);
  }
}
module pulley_a() small_pulley(1.41, 10.15);
module pulley_b() small_pulley(1.39, 10);

// ---------- X idler on an M3 bolt (free stopgap for Tim's cut nail) ----------
// pulley_a with a 3.3 bore and a short hub each side, so it spins on an M3 bolt through the bracket's
// 3.1 mm wall holes. The hubs touch the washers close to the bolt (less rubbing than the 18 mm
// flanges). Two printed washers fill the bracket's 14 mm inner gap and keep the pulley centred.
// Hardware: M3 x 25 bolt + nut (nylock, snug, not tight). If 3.3 prints tight, drill it with 1/8".
m3_bore = 3.3;
idler_hub = 0.5;      // hub sleeve sticking out past each flange
idler_hub_d = 7;      // hub (and washer) diameter
idler_gap = 14;       // bracket inner gap (walls at x 0-2 and 16-18)
idler_play = 0.4;     // total end play so it spins freely
idler_washer_t = (idler_gap - 10.15 - 2 * idler_hub - idler_play) / 2;   // = 1.225
module pulley_m3() small_pulley(1.41, 10.15, m3_bore, idler_hub, idler_hub_d);
module idler_washer() difference() {
  cylinder(d = idler_hub_d, h = idler_washer_t);
  translate([0, 0, -1]) cylinder(d = m3_bore, h = idler_washer_t + 2);
}

// ---------- paper ring: holds the paper's edge flat on the 200 mm platter ----------
// Thin, so the pen (pen up = 2 mm) can pass near it. Covers the paper from radius 92 to 100: keep
// drawings inside radius ~90. The platter is aluminium (not magnetic), so magnets in the ring need 4
// partners glued under the platter rim at the same spots (magnets or steel washers).
ring_od = 200;        // platter diameter (uxcell 5052 disc, 200 x 1)
ring_w = 8;           // band width
ring_t = 1.2;         // band thickness
ring_magnets = true;  // true: 4 pockets for 6 x 2 mm disc magnets. false: 4 tape tabs instead ($0)
magnet_d = 6.2;       // pocket for a 6 mm magnet (press fit, add a drop of glue)
magnet_h = 2;         // magnet thickness = pad height, pocket goes through (magnet flush both faces)
tab_len = 6;          // tape tab, sticks out past the platter edge
tab_w = 14;
module paper_ring() {
  rm = ring_od / 2 - ring_w / 2;
  difference() {
    union() {
      difference() {
        cylinder(d = ring_od, h = ring_t, $fn = 240);
        translate([0, 0, -1]) cylinder(d = ring_od - 2 * ring_w, h = ring_t + 2, $fn = 240);
      }
      for (a = [45 : 90 : 315]) rotate(a)
        if (ring_magnets) intersection() {
          translate([rm, 0, 0]) cylinder(d = magnet_d + 3.2, h = magnet_h);
          cylinder(d = ring_od, h = magnet_h, $fn = 240);
        }
        else translate([ring_od / 2 - 2, -tab_w / 2, 0]) cube([tab_len + 2, tab_w, ring_t]);
    }
    if (ring_magnets) for (a = [45 : 90 : 315]) rotate(a)
      translate([rm, 0, -1]) cylinder(d = magnet_d, h = magnet_h + 2);
  }
}

// ---------- small gear: 15 teeth, 5 tall, 4.2 mm bore with a 7 mm counterbore on top ----------
gear15_tooth = [7.065, 7.141, 7.267, 7.433, 7.524, 7.518, 7.516, 7.518,
                7.524, 7.439, 7.267, 7.145, 7.066, 7.019, 7.003, 7.018];
module gear() {
  difference() {
    toothed(15, gear15_tooth, 5);
    translate([0, 0, -1]) cylinder(d = 4.2, h = 7);
    translate([0, 0, 2.88]) cylinder(d = 7, h = 3);
  }
}

// ---------- direct-drive platter (2026-10-26): hub on the NEMA 17 shaft + a stand for the motor ----------
// Replaces the disc-drive spindle, both platter pulleys and the closed belt (docs/components.md §7).
// The platter (200 x 1 mm aluminium disc, CD glued underneath) is glued to the hub's top face; the
// raised ring fits the CD's 15 mm hole so it sits centred. Measure the shaft with calipers first.
shaft_d    = 5;       // NEMA 17 shaft (17HE15-1504S)
shaft_flat = 4.5;     // across the D flat (0.5 mm cut)
bore_fit   = 0.15;    // clearance on the bore and the flat
hub_d      = 22;      // collar around the shaft
hub_h      = 16;      // collar + flange height (shaft tip ends flush with the ring's top)
flange_d   = 40;      // glue face under the CD
flange_t   = 2.5;     // flange thickness; a 45 degree cone below it, so it prints collar-down with no supports
reg_d      = 14.7;    // ring that drops into the CD's 15 mm hole (0 = no ring, glue straight to the disc)
reg_h      = 1.0;     // CD is 1.2 thick, so the ring stays below the disc
set_z      = 5;       // M3 set screw height above the hub's bottom (on the shaft's flat)
nut_w      = 5.8;     // M3 nut slot: 5.5 across flats + clearance
nut_t      = 2.6;     // nut is 2.4 thick
nut_x      = 4.0;     // slot's inner face, from the shaft axis (leaves ~1.9 mm wall to the flat)
module platter_hub() {
  cone_h = (flange_d - hub_d) / 2;
  fx = shaft_flat + bore_fit - (shaft_d + bore_fit) / 2;           // the flat's distance from the axis
  difference() {
    union() {
      cylinder(d = hub_d, h = hub_h);
      translate([0, 0, hub_h - flange_t - cone_h]) cylinder(d1 = hub_d, d2 = flange_d, h = cone_h);
      translate([0, 0, hub_h - flange_t]) cylinder(d = flange_d, h = flange_t);
      if (reg_d > 0) translate([0, 0, hub_h - 0.01]) cylinder(d = reg_d, h = reg_h + 0.01);
    }
    // D bore, through
    translate([0, 0, -1]) intersection() {
      cylinder(d = shaft_d + bore_fit, h = hub_h + reg_h + 2, $fn = 64);
      translate([-shaft_d, -shaft_d, 0]) cube([shaft_d + fx, 2 * shaft_d, hub_h + reg_h + 2]);
    }
    translate([0, 0, -0.01]) cylinder(d1 = shaft_d + 1.2, d2 = shaft_d + bore_fit, h = 0.6, $fn = 64);   // lead-in
    // M3 set screw through the flat side, captive nut dropped in from below
    translate([0, 0, set_z]) rotate([0, 90, 0]) cylinder(d = 3.2, h = hub_d, $fn = 24);
    translate([nut_x, -nut_w / 2, -1]) cube([nut_t, nut_w, set_z + 1 + 3.25]);
  }
}

// Holds the motor upright on the plywood by its four face screws (M3 x 8), so no hole in the board
// and no steel bars. Two side walls, open front and back for the plug; feet take small wood screws.
motor_len  = 38;      // 17HE15-1504S body length (without the 2 mm boss)
stand_gap  = 0.5;     // motor's back end hangs this far above the board, so the face screws pull it tight
stand_top  = 4;       // top plate thickness; the 2 mm boss sits in its hole
stand_wall = 3;
motor_w    = 42.3;
motor_fit  = 0.4;     // clearance each side of the motor body
foot_w     = 10;      // foot sticking out past each wall
foot_t     = 4;
module motor_stand() {
  h = motor_len + stand_gap;
  in = motor_w / 2 + motor_fit;
  out = in + stand_wall;
  difference() {
    union() {
      for (s = [-1, 1]) translate([s > 0 ? in : -out, -out, 0]) cube([stand_wall, 2 * out, h]);
      translate([-out, -out, h]) cube([2 * out, 2 * out, stand_top]);
      for (s = [-1, 1]) translate([s > 0 ? out - 0.01 : -out - foot_w + 0.01, -out, 0]) cube([foot_w, 2 * out, foot_t]);
    }
    translate([0, 0, h - 1]) cylinder(d = 23, h = stand_top + 2);     // boss
    translate([0, 0, h]) nema_screws(stand_top);
    for (s = [-1, 1], y = [-out + 8, out - 8]) translate([s * (out + foot_w / 2), y, -1]) cylinder(d = 3.5, h = foot_t + 2, $fn = 24);
  }
}

// ---------- layout: where each part sat on the TinkerCad plate ----------
module show(name) { if (part == "all" || part == name) children(); }

show("motor_plate")   translate([-29, -87, 0]) motor_plate();
show("base_plate")    translate([-28, 1, plate_add]) base_plate();
show("motor_plate_2") translate([-94.18, 13.06, 0]) motor_plate_2();
show("big_pulley")    translate([-62, -20, 0]) big_pulley();
show("spool")         for (p = [[81, 41], [81, 72.5], [49, 41], [49, 72.5]]) translate(p) spool();
show("bracket")       translate([-87, -82, 0]) bracket();
show("clip")          translate([60, -2, 0]) clip();
show("pulley_a")      translate([-48, -61.99, 0]) pulley_a();
show("pulley_b")      translate([-62, -20, 0]) pulley_b();
show("gear")          translate([47.5, 8.5, 0]) gear();
show("platter_hub")   translate([125, -50, 0]) platter_hub();      // new parts, right of the old plate
show("motor_stand")   translate([145, 30, 0]) motor_stand();
// added 2026-10-26 (not on the TinkerCad plate): laid out below it
show("big_pulley_gt2") translate([-62, -150, 0]) big_pulley_gt2();
show("pulley_m3")     translate([-25, -150, 0]) pulley_m3();
show("idler_washer")  for (x = [-8, 2]) translate([x, -150, 0]) idler_washer();
show("paper_ring")    translate([0, -270, 0]) paper_ring();

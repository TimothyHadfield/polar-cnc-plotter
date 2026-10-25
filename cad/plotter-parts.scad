// Polar plotter printed parts, redrawn from Tim's TinkerCad export "Polar Potter Custom.stl".
// All sizes in mm. Each part is a module built at its own origin; the bottom of this file lays
// them out exactly where they sat on the TinkerCad print plate.
// Show one part only: set `part` below (or run openscad -D 'part="clip"').

part = "all";   // all, motor_plate, base_plate, motor_plate_2, big_pulley, spool, bracket, clip,
                // pulley_a, pulley_b, gear

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
module motor_plate() {
  t = 2;
  difference() {
    cube([120, 73, t]);
    translate([20, 36.5, 0]) {
      translate([0, 0, -1]) cylinder(d = 10, h = t + 2);           // shaft
      translate([0, 0, t - 1]) cylinder(d = 25, h = 2);            // 1 mm recess for the motor collar
      nema_screws(t);
    }
  }
}

// ---------- base plate: 57 x 95 plate, raised block, two capped pegs ----------
cap_gap = 0;   // TinkerCad had the caps floating 0.33 mm above the pegs (they would print in mid-air)
module base_plate() {
  cube([57, 95, 2]);
  translate([0, 35, 0]) cube([57, 25, 8.17]);
  for (x = [9, 48]) translate([x, 55, 0]) {
    cylinder(d = 6.4, h = 17.67);
    translate([0, 0, 17.67 + cap_gap]) cylinder(d = 10, h = 2);
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
module small_pulley(f, h) {
  difference() {
    union() {
      cylinder(d = 18, h = f);
      translate([0, 0, f]) toothed(20, gt2_20_tooth, h - 2 * f);
      translate([0, 0, h - f]) cylinder(d = 18, h = f);
    }
    translate([0, 0, -1]) cylinder(d = 5.15, h = h + 2);
  }
}
module pulley_a() small_pulley(1.41, 10.15);
module pulley_b() small_pulley(1.39, 10);

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

// ---------- layout: where each part sat on the TinkerCad plate ----------
module show(name) { if (part == "all" || part == name) children(); }

show("motor_plate")   translate([-29, -87, 0]) motor_plate();
show("base_plate")    translate([-28, 1, 0]) base_plate();
show("motor_plate_2") translate([-94.18, 13.06, 0]) motor_plate_2();
show("big_pulley")    translate([-62, -20, 0]) big_pulley();
show("spool")         for (p = [[81, 41], [81, 72.5], [49, 41], [49, 72.5]]) translate(p) spool();
show("bracket")       translate([-87, -82, 0]) bracket();
show("clip")          translate([60, -2, 0]) clip();
show("pulley_a")      translate([-48, -61.99, 0]) pulley_a();
show("pulley_b")      translate([-62, -20, 0]) pulley_b();
show("gear")          translate([47.5, 8.5, 0]) gear();

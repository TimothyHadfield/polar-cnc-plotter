// Motor plate: flat plate with a NEMA 17 mount.
// Redrawn from Tim's TinkerCad export "Polar Potter Custom.stl" (largest part on that plate).
// All sizes in mm. Origin = the plate's front-left bottom corner.

plate_w = 120;          // X
plate_d = 73;           // Y
plate_t = 2;            // thickness (original 2; thin for a motor mount, Tim's call)

// NEMA 17 mount
motor_x = 20;           // centre of the motor from the plate's left edge
motor_y = 36.5;         // centre of the motor from the plate's front edge
hole_pitch = 31;        // NEMA 17 screw spacing (standard)
screw_d = 3.4;          // M3 clearance. Original 3.0, which usually prints too tight.
shaft_d = 10;           // through hole for the shaft
boss_d = 25;            // recess for the motor's 22 mm centring collar
boss_depth = 1;         // depth of that recess (from the top face)

$fn = 64;

difference() {
  cube([plate_w, plate_d, plate_t]);
  translate([motor_x, motor_y, 0]) {
    // shaft hole
    translate([0, 0, -1]) cylinder(d = shaft_d, h = plate_t + 2);
    // collar recess
    translate([0, 0, plate_t - boss_depth]) cylinder(d = boss_d, h = boss_depth + 1);
    // four screw holes
    for (sx = [-1, 1], sy = [-1, 1])
      translate([sx * hole_pitch / 2, sy * hole_pitch / 2, -1])
        cylinder(d = screw_d, h = plate_t + 2);
  }
}

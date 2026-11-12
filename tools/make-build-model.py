"""Export the 3D build guide model and the printable STLs.

    python tools/make-build-model.py        V1 (as before): build/plotter.glb + build/stl/*.stl
    python tools/make-build-model.py v2     V2 only: build/plotter-v2.glb (no STLs are touched)
    python tools/make-build-model.py all    both

Needs OpenSCAD and Python with trimesh + numpy. Writes:
  build/plotter.glb     every assembly part as a named node with a PBR material (read by js/build.js).
                        A part with several colours is split into pieces named "<part>__<piece>".
  build/stl/<part>.stl  Tim's printed parts, one file each, ready to slice
  build/plotter-v2.glb  prototype 2 (cad/printed-frame.scad assembly()), same node naming. Its
                        printed frame STLs (build/stl/frame_*.stl) are exported from printed-frame.scad.
"""
import os, re, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OPENSCAD = os.environ.get("OPENSCAD", r"C:\Program Files\OpenSCAD\openscad.exe")
ASSEMBLY = os.path.join(ROOT, "cad", "plotter-assembly.scad")
PARTS = os.path.join(ROOT, "cad", "plotter-parts.scad")

# (sRGB colour, metallic, roughness); colours as they look in Tim's photos (docs/photos/)
PRINTED_MAT = ("#14a83c", 0.0, 0.5)     # bright green PLA (rod supports, pulleys)
PVC = ("#f3f3ef", 0.0, 0.32)
STEEL = ("#e6e9ec", 1.0, 0.12)          # chrome rods, shafts
ALU = ("#c9ccd0", 1.0, 0.38)
BEAD_BLAST = ("#c4c7cb", 1.0, 0.55)     # SC8UU blocks
MOTOR = ("#1d1e21", 0.25, 0.45)
BELT = ("#141416", 0.0, 0.8)
BLACK = ("#1b1c1f", 0.0, 0.55)
PCB_GREEN = ("#1f6b3c", 0.0, 0.45)
COPPER = ("#c9a24a", 1.0, 0.3)
NEMA = lambda m: {f"{m}__caps": ALU, f"{m}__body": MOTOR, f"{m}__core": MOTOR, f"{m}__screws": STEEL,
                  f"{m}__plug": ("#f2f0e8", 0.0, 0.5), f"{m}__label": ("#ffffff", 0.0, 0.5), f"{m}__shaft": STEEL}
MATS = {
    "board__wood": ("#c8955a", 0.0, 0.75), "board__screws": STEEL, "bars": ("#3a3b3f", 0.8, 0.45),
    "screw_holders": PRINTED_MAT, "stands": PVC, "spools": PRINTED_MAT, "rods": STEEL, "blocks": BEAD_BLAST,
    "carriage_plate": PRINTED_MAT,
    "stage__frame": ("#b5b9be", 0.9, 0.4), "stage__screw": COPPER, "stage__rails": STEEL, "stage__motor": ALU,
    "stage__flex": ("#d88a2a", 0.0, 0.5),
    "slider__block": ("#8e939a", 0.9, 0.4), "slider__nut": COPPER, "pen_clip": PRINTED_MAT, "knob": PRINTED_MAT,
    "pen__body": ("#8f949a", 0.4, 0.35), "pen__cap": ("#c41f24", 0.0, 0.3), "pen__tip": BLACK,
    "x_motor_plate": PRINTED_MAT, **NEMA("x_motor"),
    "x_pulley": ALU, "idler_bracket": PRINTED_MAT, "idler_pulley": PRINTED_MAT,
    "idler_axle__nail": ("#a7abb0", 1.0, 0.35), "idler_axle__tape": ("#1e1f22", 0.0, 0.6),
    "x_belt__belt": BELT, "x_belt__ties": ("#f1efe8", 0.0, 0.5),
    "rotary_plate": PRINTED_MAT, "spacers": PRINTED_MAT, **NEMA("y_motor"), "y_pulley": PRINTED_MAT,
    "spindle__board": PCB_GREEN, "spindle__pads": COPPER, "spindle__rotor": ALU, "big_pulley": PRINTED_MAT,
    "y_belt": BELT,
    "platter": ("#d3d6da", 0.75, 0.38), "paper__sheet": ("#ffffff", 0.0, 0.85), "steel_strip": ("#8d9196", 0.7, 0.45),
    "cd__disc": ("#dfe6ee", 0.45, 0.12), "cd__hub": ("#e9eef3", 0.0, 0.2),
    # electronics as in Tim's photos (2026-10-26): blue Uno, red shield, yellow sockets, blue heat sinks
    "electronics__uno": ("#1f4fb4", 0.0, 0.4), "electronics__chips": BLACK, "electronics__ports": ("#cfd3d8", 1.0, 0.3),
    "electronics__button": ("#e57d8c", 0.0, 0.5),
    "electronics__shield": ("#d42a20", 0.0, 0.42), "electronics__sockets": ("#f2c21b", 0.0, 0.45),
    "electronics__terminal": ("#2357d8", 0.0, 0.4), "electronics__pins": ("#d8dadd", 1.0, 0.25),
    "electronics__black": ("#18191b", 0.0, 0.5), "electronics__white": ("#f3f1ea", 0.0, 0.5),
    "electronics__drivers": ("#1c1d20", 0.0, 0.5), "electronics__heatsinks": ("#2346d6", 0.6, 0.35),
    "electronics__pots": ("#ece8dc", 0.0, 0.5),
    "power_jack": BLACK,
}


def linear(c):
    """glTF stores base colours in linear light, not sRGB."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
PRINTED = ["spool", "carriage_plate", "motor_plate", "motor_plate_2", "big_pulley", "pulley_a", "pulley_b",
           "bracket", "clip", "gear", "platter_hub", "motor_stand",
           "big_pulley_gt2", "pulley_m3", "idler_washer", "paper_ring"]
PRINTED_SRC = {"carriage_plate": "base_plate"}   # file name -> module name in plotter-parts.scad


def scad(src, name, out, key="part"):
    part, _, sub = name.partition("__")
    r = subprocess.run([OPENSCAD, "-o", out, "-D", f'{key}="{part}"', "-D", f'sub="{sub}"', src],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(out):
        sys.exit(f"openscad failed for {name}:\n{r.stderr}")
    return out


def to_glb(stls, mats, out):
    scene = trimesh.Scene()
    for name, path in stls.items():
        m = trimesh.load(path, force="mesh")
        m.merge_vertices()
        color, metal, rough = mats[name]
        rgba = [linear(int(color[i:i + 2], 16) / 255) for i in (1, 3, 5)] + [1.0]
        m.visual = trimesh.visual.TextureVisuals(material=PBRMaterial(
            name=name, baseColorFactor=rgba, metallicFactor=metal, roughnessFactor=rough))
        # glTF is Y-up: turn the Z-up model so it stands upright in the viewer
        m.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
        scene.add_geometry(m, node_name=name, geom_name=name)
    scene.export(out)
    print(f"{out}: {os.path.getsize(out) // 1024} KB, {len(stls)} pieces")


# ---------- V2: prototype 2, the printed frame (cad/printed-frame.scad) ----------
FRAME = os.path.join(ROOT, "cad", "printed-frame.scad")
PRINT_FRAME = ("#e07a35", 0.0, 0.5)     # frame prints in the CAD renders' colours (filament not chosen yet)
PRINT_WHEEL = ("#2f8fb3", 0.0, 0.5)
_SAME = ["rods", "blocks", "carriage_plate", "stage__frame", "stage__screw", "stage__rails", "stage__motor",
         "stage__flex", "slider__block", "slider__nut", "pen_clip", "knob", "pen__body", "pen__cap", "pen__tip",
         "x_pulley", "x_belt__belt", "x_belt__ties", "paper__sheet"] + [k for k in MATS if k.startswith("electronics__")]
MATS_V2 = {
    "frame_base": PRINT_FRAME, "stand_right": PRINT_FRAME, "stand_left": PRINT_FRAME,
    "wheel": PRINT_WHEEL, "collar": ("#e0a020", 0.0, 0.5), "clamp_ring": ("#1f5f7a", 0.0, 0.5),
    "pad": ("#3a3c40", 0.0, 0.9),
    "idler": ALU, "idler_spacers": PRINT_FRAME, "idler_bolt": STEEL,
    **NEMA("x_motor"), **NEMA("y_motor"),
    **{k: MATS[k] for k in _SAME},
}
# numbers read out of printed-frame.scad, so the V2 model follows any change there
V2_VARS = ["pen_y", "wheel_z0", "face_z", "plate_top", "pad_t", "paper_t", "disc_d", "lift", "mx", "col_y0",
           "belt_z", "ix", "rod_y", "rod_lo", "rod_hi", "rod_len", "ard_x", "ard_y", "uno_pad", "idler_w", "spacer_t",
           "idler_gap", "cheek_t"]


def frame_numbers(tmp):
    src = os.path.join(tmp, "v2vars.scad")
    with open(src, "w") as f:
        f.write(f'include <{FRAME.replace(os.sep, "/")}>\npart = "none";\n'
                f'echo(V2 = [{", ".join(V2_VARS)}], P = platter);\n')
    out = os.path.join(tmp, "v2vars.echo")
    r = subprocess.run([OPENSCAD, "-o", out, src], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(out):
        sys.exit(f"openscad failed reading printed-frame numbers:\n{r.stderr}")
    text = open(out).read()
    nums = re.search(r"V2 = \[([^\]]*)\]", text).group(1).split(",")
    v = dict(zip(V2_VARS, (float(n) for n in nums)))
    if '"printed"' not in text:
        sys.exit("plotter-v2.glb assumes platter = \"printed\" in printed-frame.scad")
    return v


# The assembly as in printed-frame.scad assembly(), split into named parts. The bought bearing
# idler, its two printed spacers and the M3 bolt (11-12) replace the retired printed pulley_m3, and
# the belt is re-run round the idler at -ix.
V2_SCAD = """
use <{frame}>
include <{assembly}>
part = "none";
v2 = "";
$fn = 64;
module v2show(n) if (v2 == n) children();
module bearing_idler() {{          // bought GT2 20T idler, 3 mm bore: toothed body between 18 mm flanges, z = axis
  w = {idler_w};
  difference() {{
    union() {{
      for (z = [-w / 2, w / 2 - 1]) translate([0, 0, z]) cylinder(d = 18, h = 1);
      translate([0, 0, -w / 2]) difference() {{
        cylinder(d = 12.2, h = w);
        for (i = [0 : 19]) rotate(i * 18) translate([6.1, 0, 0.9]) cylinder(d = 1.2, h = w - 1.8, $fn = 8);
      }}
    }}
    translate([0, 0, -w / 2 - 1]) cylinder(d = 3.2, h = w + 2, $fn = 24);
  }}
}}
v2show("frame_base") frame_base();
v2show("stand_right") stand_right();
v2show("stand_left") stand_left();
v2show("wheel") translate([0, {pen_y}, {wheel_z0}]) platter_wheel();
v2show("collar") translate([0, {pen_y}, {wheel_z0}]) shaft_collar();
v2show("pad") translate([0, {pen_y}, {plate_top}]) cylinder(d = {disc_d}, h = {pad_t}, $fn = 160);
v2show("paper") piece("sheet") translate([0, {pen_y}, {pz} + 0.05]) cylinder(d = {disc_d} - 4, h = {paper_t}, $fn = 160);
v2show("clamp_ring") translate([0, {pen_y}, {pz} + {paper_t} + 0.1]) clamp_ring();
v2show("y_motor") translate([0, {pen_y}, {face_z}]) nema17();
v2show("x_motor") translate([{mx}, {col_y0}, {belt_z}]) rotate([-90, 0, 0]) rotate([0, 0, 180]) nema17();
v2show("rods") for (z = [{rod_lo}, {rod_hi}]) translate([-{rod_len} / 2, {rod_y}, z]) rotate([0, 90, 0]) cylinder(d = 8, h = {rod_len});
v2show("idler") translate([-{ix}, {rod_y}, {belt_z}]) rotate([90, 0, 0]) bearing_idler();
v2show("idler_spacers") for (y = [{rod_y} - {idler_w} / 2 - {spacer_t}, {rod_y} + {idler_w} / 2])
  translate([-{ix}, y, {belt_z}]) rotate([-90, 0, 0]) idler_spacer();
v2show("idler_bolt") translate([-{ix}, 0, {belt_z}]) rotate([-90, 0, 0]) {{   // M3 x 25, head in front, nut in its pocket
  y0 = {rod_y} - {idler_gap} / 2 - {cheek_t};
  translate([0, 0, y0 - 3]) cylinder(d = 5.5, h = 3, $fn = 24);
  translate([0, 0, y0]) cylinder(d = 3, h = 25, $fn = 16);
  translate([0, 0, {rod_y} + {idler_gap} / 2 + {cheek_t} - 2.5]) cylinder(d = 6.2, h = 2.4, $fn = 6);
}}
translate([0, 0, {lift}]) {{
  v2show("blocks") blocks();
  v2show("carriage_plate") carriage_plate();
  v2show("stage") stage();
  v2show("slider") slider();
  v2show("pen_clip") pen_clip();
  v2show("knob") knob();
  v2show("pen") the_pen();
  v2show("x_pulley") x_pulley();
}}
v2show("x_belt") translate([0, {rod_y} + 3, {belt_z}]) rotate([90, 0, 0])
  open_belt(-{ix}, 6.37, {mx}, 5.09, [-peg_x, peg_x], peg_z - belt_z, 3.2);
v2show("electronics") translate([{ard_x}, {ard_y}, {uno_pad}]) rotate(-90) {{ uno(); drivers(); }}
"""


def build_v2(tmp):
    v = frame_numbers(tmp)
    src = os.path.join(tmp, "plotter-v2.scad")
    with open(src, "w") as f:
        f.write(V2_SCAD.format(frame=FRAME.replace(os.sep, "/"), assembly=ASSEMBLY.replace(os.sep, "/"),
                               pz=v["plate_top"] + v["pad_t"], **v))
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as pool:
        stls = dict(zip(MATS_V2, pool.map(lambda p: scad(src, p, os.path.join(tmp, "v2_" + p + ".stl"), "v2"), MATS_V2)))
    to_glb(stls, MATS_V2, os.path.join(ROOT, "build", "plotter-v2.glb"))


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "v1"
    if target in ("v2", "all"):
        build_v2(tempfile.mkdtemp())
    if target in ("v1", "all"):
        build_v1()


def build_v1():
    tmp = tempfile.mkdtemp()
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as pool:
        stls = dict(zip(MATS, pool.map(lambda p: scad(ASSEMBLY, p, os.path.join(tmp, p + ".stl")), MATS)))
        os.makedirs(os.path.join(ROOT, "build", "stl"), exist_ok=True)
        list(pool.map(lambda p: scad(PARTS, PRINTED_SRC.get(p, p), os.path.join(ROOT, "build", "stl", p + ".stl")), PRINTED))

    to_glb(stls, MATS, os.path.join(ROOT, "build", "plotter.glb"))
    # printed STLs: binary instead of OpenSCAD's ASCII (about 5x smaller)
    for p in PRINTED:
        f = os.path.join(ROOT, "build", "stl", p + ".stl")
        trimesh.load(f, force="mesh").export(f)


if __name__ == "__main__":
    main()

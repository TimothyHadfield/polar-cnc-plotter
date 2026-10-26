"""Export the 3D build guide model and the printable STLs.

    python tools/make-build-model.py

Needs OpenSCAD and Python with trimesh + numpy. Writes:
  build/plotter.glb     every assembly part as a named node with a PBR material (read by js/build.js).
                        A part with several colours is split into pieces named "<part>__<piece>".
  build/stl/<part>.stl  Tim's printed parts, one file each, ready to slice
"""
import os, subprocess, sys, tempfile
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
           "bracket", "clip", "gear"]
PRINTED_SRC = {"carriage_plate": "base_plate"}   # file name -> module name in plotter-parts.scad


def scad(src, name, out):
    part, _, sub = name.partition("__")
    r = subprocess.run([OPENSCAD, "-o", out, "-D", f'part="{part}"', "-D", f'sub="{sub}"', src],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(out):
        sys.exit(f"openscad failed for {name}:\n{r.stderr}")
    return out


def main():
    tmp = tempfile.mkdtemp()
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as pool:
        stls = dict(zip(MATS, pool.map(lambda p: scad(ASSEMBLY, p, os.path.join(tmp, p + ".stl")), MATS)))
        os.makedirs(os.path.join(ROOT, "build", "stl"), exist_ok=True)
        list(pool.map(lambda p: scad(PARTS, PRINTED_SRC.get(p, p), os.path.join(ROOT, "build", "stl", p + ".stl")), PRINTED))

    scene = trimesh.Scene()
    for name, path in stls.items():
        m = trimesh.load(path, force="mesh")
        m.merge_vertices()
        color, metal, rough = MATS[name]
        rgba = [linear(int(color[i:i + 2], 16) / 255) for i in (1, 3, 5)] + [1.0]
        m.visual = trimesh.visual.TextureVisuals(material=PBRMaterial(
            name=name, baseColorFactor=rgba, metallicFactor=metal, roughnessFactor=rough))
        # glTF is Y-up: turn the Z-up model so it stands upright in the viewer
        m.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
        scene.add_geometry(m, node_name=name, geom_name=name)
    out = os.path.join(ROOT, "build", "plotter.glb")
    scene.export(out)
    # printed STLs: binary instead of OpenSCAD's ASCII (about 5x smaller)
    for p in PRINTED:
        f = os.path.join(ROOT, "build", "stl", p + ".stl")
        trimesh.load(f, force="mesh").export(f)
    print(f"{out}: {os.path.getsize(out) // 1024} KB, {len(stls)} pieces")


if __name__ == "__main__":
    main()

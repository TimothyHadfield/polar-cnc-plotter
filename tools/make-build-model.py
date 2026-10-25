"""Export the 3D build guide model and the printable STLs.

    python tools/make-build-model.py

Needs OpenSCAD and Python with trimesh + numpy. Writes:
  build/plotter.glb     every assembly part as a named, coloured node (read by js/build.js)
  build/stl/<part>.stl  Tim's printed parts, one file each, ready to slice
"""
import os, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import trimesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OPENSCAD = os.environ.get("OPENSCAD", r"C:\Program Files\OpenSCAD\openscad.exe")
ASSEMBLY = os.path.join(ROOT, "cad", "plotter-assembly.scad")
PARTS = os.path.join(ROOT, "cad", "plotter-parts.scad")

PRINT_GREEN, WHITE, STEEL, ALU, BLACK = "#3fbf62", "#f2f2ee", "#b9bec4", "#d4d7db", "#26272b"
COLORS = {
    "board": "#c79a63", "bars": "#3a3b3f", "screw_holders": PRINT_GREEN, "stands": WHITE,
    "spools": PRINT_GREEN, "rods": STEEL, "blocks": ALU, "carriage_plate": PRINT_GREEN,
    "stage": "#8a8f96", "slider": "#5b6068", "pen_clip": PRINT_GREEN, "knob": PRINT_GREEN, "pen": "#c8312b",
    "x_motor_plate": PRINT_GREEN, "x_motor": BLACK, "x_pulley": ALU, "idler_bracket": PRINT_GREEN,
    "idler_pulley": PRINT_GREEN, "x_belt": "#111111", "rotary_plate": PRINT_GREEN, "spacers": PRINT_GREEN,
    "y_motor": BLACK, "y_pulley": PRINT_GREEN, "spindle": "#2f6b3a", "big_pulley": PRINT_GREEN,
    "y_belt": "#111111", "platter": ALU, "paper": "#ffffff", "steel_strip": "#8d9196", "cd": "#c9d6e3",
    "electronics": "#c62f2f", "power_jack": BLACK,
}
PRINTED = ["spool", "carriage_plate", "motor_plate", "motor_plate_2", "big_pulley", "pulley_a", "pulley_b",
           "bracket", "clip", "gear"]
PRINTED_SRC = {"carriage_plate": "base_plate"}   # file name -> module name in plotter-parts.scad


def scad(src, part, out):
    r = subprocess.run([OPENSCAD, "-o", out, "-D", f'part="{part}"', src], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(out):
        sys.exit(f"openscad failed for {part}:\n{r.stderr}")
    return out


def main():
    tmp = tempfile.mkdtemp()
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as pool:
        stls = dict(zip(COLORS, pool.map(lambda p: scad(ASSEMBLY, p, os.path.join(tmp, p + ".stl")), COLORS)))
        os.makedirs(os.path.join(ROOT, "build", "stl"), exist_ok=True)
        list(pool.map(lambda p: scad(PARTS, PRINTED_SRC.get(p, p), os.path.join(ROOT, "build", "stl", p + ".stl")), PRINTED))

    scene = trimesh.Scene()
    for name, path in stls.items():
        m = trimesh.load(path, force="mesh")
        m.merge_vertices()
        rgba = [int(COLORS[name][i:i + 2], 16) for i in (1, 3, 5)] + [255]
        m.visual = trimesh.visual.ColorVisuals(m, face_colors=np.tile(rgba, (len(m.faces), 1)))
        # glTF is Y-up: turn the Z-up model so it stands upright in the viewer
        m.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
        scene.add_geometry(m, node_name=name, geom_name=name)
    out = os.path.join(ROOT, "build", "plotter.glb")
    scene.export(out)
    # printed STLs: binary instead of OpenSCAD's ASCII (about 5x smaller)
    for p in PRINTED:
        f = os.path.join(ROOT, "build", "stl", p + ".stl")
        trimesh.load(f, force="mesh").export(f)
    print(f"{out}: {os.path.getsize(out) // 1024} KB, {len(stls)} parts")


if __name__ == "__main__":
    main()

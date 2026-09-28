; Polar plot from polar-cnc-plotter
; X = carriage mm (0 = closest to centre), Y = platter degrees. Gap 0 mm
; Before plotting: pen just touching the paper at the centre point, then G92 X0 Y0 Z0
G21 G90 G93
G0 Z2.000
G0 X1.000 Y0.000
G0 Z0.000
G1 X60.000 Y0.000 F10.2
G0 Z2.000
G94
M2

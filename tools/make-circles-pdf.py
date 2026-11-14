"""Cutting templates for the platter: build/print/paper_and_pad_circles.pdf (US Letter, 2 pages).

Page 1: the paper circle (196 mm, as in the build guide). Page 2: the soft pad (200 mm = the
platter, `disc_d` in cad/printed-frame.scad). Each page has a 100 mm line to check the print scale.
No dependencies: the PDF is written by hand. Run: python tools/make-circles-pdf.py
"""
import os

MM = 72 / 25.4                      # PDF points per mm
W, H = 215.9, 279.4                 # US Letter, mm
K = 0.5522847498                    # circle from 4 Bezier curves

def circle(cx, cy, r):
    k = K * r
    p = lambda x, y: f'{x * MM:.3f} {y * MM:.3f}'
    return (f'{p(cx + r, cy)} m '
            f'{p(cx + r, cy + k)} {p(cx + k, cy + r)} {p(cx, cy + r)} c '
            f'{p(cx - k, cy + r)} {p(cx - r, cy + k)} {p(cx - r, cy)} c '
            f'{p(cx - r, cy - k)} {p(cx - k, cy - r)} {p(cx, cy - r)} c '
            f'{p(cx + k, cy - r)} {p(cx + r, cy - k)} {p(cx + r, cy)} c S')

def line(x1, y1, x2, y2):
    return f'{x1 * MM:.3f} {y1 * MM:.3f} m {x2 * MM:.3f} {y2 * MM:.3f} l S'

def text(x, y, size, s):
    s = s.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')
    return f'BT /F1 {size} Tf {x * MM:.3f} {y * MM:.3f} Td ({s}) Tj ET'

def page(title, d, cross):
    cx, cy = W / 2, H / 2
    out = ['0 G 0 g', '0.4 w', circle(cx, cy, d / 2)]
    if cross:
        out += [line(cx - 4, cy, cx + 4, cy), line(cx, cy - 4, cx, cy + 4)]
    out += [text(12, H - 16, 15, title),
            text(12, H - 23, 10, 'Print at 100 % ("Actual size"), not "Fit to page". Cut on the line.')]
    x0, y0 = (W - 100) / 2, 18       # the scale check, below the circle
    out += [line(x0, y0, x0 + 100, y0)]
    out += [line(x0 + i * 10, y0, x0 + i * 10, y0 + (3 if i % 5 else 5)) for i in range(11)]
    out += [text(x0, y0 - 6, 10, 'This line is 100 mm. Check it with a ruler before cutting.')]
    return '\n'.join(out)

def build(pages):
    objs = ['<< /Type /Catalog /Pages 2 0 R >>', None,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    kids = []
    for body in pages:
        n = len(objs) + 1
        kids.append(f'{n} 0 R')
        objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W * MM:.2f} {H * MM:.2f}] '
                    f'/Resources << /Font << /F1 3 0 R >> >> /Contents {n + 1} 0 R >>')
        objs.append(f'<< /Length {len(body)} >>\nstream\n{body}\nendstream')
    objs[1] = f'<< /Type /Pages /Kids [{" ".join(kids)}] /Count {len(kids)} >>'
    out, offs = b'%PDF-1.4\n', []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f'{i} 0 obj\n{o}\nendobj\n'.encode('latin-1')
    xref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode()
    out += ''.join(f'{o:010d} 00000 n \n' for o in offs).encode()
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return out

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, '..', 'build', 'print', 'paper_and_pad_circles.pdf')
    data = build([page('Paper circle: 196 mm', 196, False),
                  page('Soft pad circle: 200 mm (same as the platter)', 200, True)])
    with open(path, 'wb') as f:
        f.write(data)
    print('wrote', os.path.normpath(path), len(data), 'bytes')

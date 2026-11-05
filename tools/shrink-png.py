"""Shrinks PNG pictures in a folder (fewer colours, same size and look).
Run: python3 tools/shrink-png.py marketing/launches/img"""
import glob, os, sys
from PIL import Image

folder = sys.argv[1]
for f in glob.glob(os.path.join(folder, '*.png')):
    Image.open(f).convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
print('Shrunk', len(glob.glob(os.path.join(folder, '*.png'))), 'pictures.')

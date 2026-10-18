"""Build index.html: the page shell from src/shell.html plus every src/0*.js module, inlined in order.

Usage: python3 build.py
"""
import glob
import pathlib

root = pathlib.Path(__file__).parent
js = '\n'.join((root / f).read_text() for f in sorted(glob.glob(str(root / 'src' / '0*.js'))))
shell = (root / 'src' / 'shell.html').read_text()
html = (shell
        + '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n'
        + '<script>\n' + js + '\n</script>\n')
(root / 'index.html').write_text(html)
print(f'index.html written ({len(html):,} bytes)')

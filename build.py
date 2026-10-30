"""Build index.html (and docs/index.html for GitHub Pages): the page shell from src/shell.html plus every src/0*.js module, inlined in order.

Usage: python3 build.py
"""
import glob
import pathlib
import shutil

root = pathlib.Path(__file__).parent
js = '\n'.join((root / f).read_text() for f in sorted(glob.glob(str(root / 'src' / '0*.js'))))
shell = (root / 'src' / 'shell.html').read_text()
html = (shell
        + '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n'
        + '<script>\n' + js + '\n</script>\n</body>\n</html>\n')
# Written twice so GitHub Pages works whether it publishes from the repo root or from /docs
(root / 'index.html').write_text(html)
(root / 'docs').mkdir(exist_ok=True)
(root / 'docs' / 'index.html').write_text(html)
for d in (root, root / 'docs'):
    (d / '.nojekyll').write_text('')
    target_assets = d / 'assets'
    target_assets.mkdir(exist_ok=True)
    for asset in (root / 'assets').glob('*'):
        if asset.is_file() and asset.parent != target_assets:
            shutil.copy2(asset, target_assets / asset.name)
print(f'index.html and docs/index.html written ({len(html):,} bytes)')

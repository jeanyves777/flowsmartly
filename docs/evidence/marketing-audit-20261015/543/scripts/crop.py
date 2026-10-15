import sys,glob
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
d=sys.argv[1]; lim={390:2800,768:2200,1440:2000}
for f in glob.glob(d+'/*.jpg'):
    im=Image.open(f); w,h=im.size; m=lim.get(w) or lim.get({720:1440,512:768}.get(w,0),99999)
    if h>m: im=im.crop((0,0,w,m))
    im.convert('RGB').save(f,quality=38,optimize=True)

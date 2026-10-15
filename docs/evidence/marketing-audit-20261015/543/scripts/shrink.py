import sys,glob,os
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
d=sys.argv[1]; tgt={1440:720,1536:768,1920:768,1280:640,1024:640,768:512,390:390}
for f in glob.glob(d+'/*.jpg'):
    im=Image.open(f); w,h=im.size
    t=tgt.get(w,w)
    if t<w: im=im.resize((t,int(h*t/w)),Image.LANCZOS)
    im.convert('RGB').save(f,quality=40,optimize=True)

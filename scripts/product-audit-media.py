"""Extract audit evidence from actual Playwright recordings (no generated UI).

Requires ffmpeg and Pillow. Inputs are extracted workflow artifacts. GIF timestamps
are original recording time; playback speed is unchanged. Inspect cuts after use.
"""
import argparse, hashlib, json, pathlib, shutil, subprocess
from PIL import Image, ImageDraw

p=argparse.ArgumentParser()
p.add_argument('--before',type=pathlib.Path,required=True)
p.add_argument('--before-ux',type=pathlib.Path,required=True)
p.add_argument('--after',type=pathlib.Path,required=True)
p.add_argument('--source',required=True)
p.add_argument('--output',type=pathlib.Path,default=pathlib.Path('docs/product-audit-2026-11-11/media'))
a=p.parse_args();out=a.output;out.mkdir(parents=True,exist_ok=True)
inventory=[]
def copy(src,name,stage):
    target=out/name;shutil.copy2(src,target)
    inventory.append({'file':name,'stage':stage,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})

for label in ['lesson-2','hint','complete-6']:
    copy(a.before/f'portrait--{label}.png',f'before-{label}.png','baseline')
    copy(a.after/'product-journey'/f'portrait--{label}.png',f'after-{label}.png','after')
copy(a.before_ux/'true-text-enlargement-experiment--classic-fonts-150.png','before-large-text.png','baseline-equivalent-56d0c776')
copy(a.after/'ux-20261111/true-text-enlargement-experiment--classic-fonts-150.png','after-large-text.png','after')
for scenario,label in [('phone390','home'),('phone390','books'),('phone390','calendar'),('phone390','progress'),('phone390','jars'),('phone390','medals'),('phone390','settings'),('phone390','privacy'),('landscape568','classic'),('largeTextLandscape','classic'),('book-filters-and-large-field','large-bottom'),('daily-result-bronze','result')]:
    copy(a.after/'ux-20261111'/f'{scenario}--{label}.png',f'checked-{scenario}-{label}.png','after-fixture-where-applicable')

# A compact before/after inspection sheet; original PNGs remain unmodified.
labels=[('lesson-2','Выбор после обучения'),('hint','Объяснение подсказки'),('complete-6','Следующая страница'),('large-text','Крупный текст')]
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
from PIL import ImageFont
font=ImageFont.truetype(font_path,17)
sheet=Image.new('RGB',(4*390,2*884),'#e7eeea');draw=ImageDraw.Draw(sheet)
for col,(label,title) in enumerate(labels):
    for row,stage in enumerate(['before','after']):
        src=Image.open(out/f'{stage}-{label}.png').convert('RGB')
        src.thumbnail((390,844))
        x=col*390;y=row*884
        draw.text((x+12,y+9),('До: ' if row==0 else 'После: ')+title,font=font,fill='#253a33')
        sheet.paste(src,(x+(390-src.width)//2,y+40))
sheet.save(out/'comparison.webp',quality=90)
inventory.append({'file':'comparison.webp','stage':'contact-sheet-original-screens'})
for video,start,length,name in [('quick-start',0.5,9.2,'quick-choice'),('portrait',3.2,4.4,'hint-and-pair'),('quick-start',30,5.5,'page-and-jar')]:
    target=out/(name+'.gif')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(start),'-t',str(length),'-i',str(a.after/'product-journey'/(video+'.webm')),'-filter_complex','fps=12,scale=390:-1:flags=lanczos,split[p][q];[p]palettegen=max_colors=96:stats_mode=diff[pal];[q][pal]paletteuse=dither=none','-loop','0',str(target)],check=True)
    inventory.append({'file':target.name,'video':video+'.webm','start_seconds':start,'length_seconds':length,'fps':12,'speed':1,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
for item in inventory:
    payload=(out/item['file']).read_bytes()
    item.update(sha256=hashlib.sha256(payload).hexdigest(),bytes=len(payload))
(out.parent/'media.json').write_text(json.dumps({'source':a.source,'recording_source':json.loads((a.after/'product-journey/report.json').read_text()).get('source'),'matrix_source':json.loads((a.after/'ux-20261111/audit.json').read_text()).get('source'),'method':'Actual browser screenshots and scripted UI recordings; known puzzle solutions and controlled native bridges; not a human playtest','files':inventory},ensure_ascii=False,indent=2))
print(json.dumps({'files':len(inventory),'bytes':sum(f.stat().st_size for f in out.iterdir())}))

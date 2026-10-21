from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
root=Path('test-results/store');out=root/'ready';out.mkdir(parents=True,exist_ok=True)
font_root=Path('/usr/share/fonts/truetype/dejavu')
font=lambda size,bold=False:ImageFont.truetype(str(font_root/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')),size)
labels={
 'phone-01-pairs':('Находите пары','Одинаковые цифры или сумма 10'),
 'phone-02-books':('100 тетрадей','2 400 задач: от коротких до больших'),
 'phone-03-calendar':('Задача на каждый день','Календарь и месячные трофеи'),
 'phone-04-jars':('Коллекция баночек','Прогресс в классике сохраняется'),
 'phone-05-dark':('Светлая и тёмная темы','Звук и вибрацию можно отключить'),
 'tablet-01-pairs':('Играйте горизонтально','Поле и управление помещаются на экране'),
 'tablet-02-books':('Большие поля','Прокрутка, подсказки и отмена ходов'),
 'tablet-03-dark':('Тёмная тема','Для телефона и планшета'),
}
manifest=[]
for name,(title,subtitle) in labels.items():
 tablet=name.startswith('tablet');size=(1920,1080) if tablet else (1080,1920)
 canvas=Image.new('RGB',size,'#e8ecea');d=ImageDraw.Draw(canvas)
 title_font=font(60 if tablet else 49,True);sub_font=font(32 if tablet else 29)
 d.text((96 if tablet else 72,52 if tablet else 84),title,font=title_font,fill='#233b51')
 d.text((96 if tablet else 72,139 if tablet else 168),subtitle,font=sub_font,fill='#526674')
 src=Image.open(root/'raw'/f'{name}.png').convert('RGB')
 target=(1728,792) if tablet else (936,1536);src=src.resize(target,Image.Resampling.LANCZOS)
 x=(size[0]-target[0])//2;y=230 if tablet else 296
 d.rounded_rectangle((x-2,y-2,x+target[0]+2,y+target[1]+2),radius=28,fill='#cbd6d8')
 mask=Image.new('L',target,0);ImageDraw.Draw(mask).rounded_rectangle((0,0,*target),radius=24,fill=255)
 canvas.paste(src,(x,y),mask)
 path=out/f'{name}.jpg';canvas.save(path,quality=95,optimize=True,subsampling=0)
 limit=5_000_000 if tablet else 3_000_000
 assert path.stat().st_size<limit
 manifest.append({'file':path.name,'size':size,'bytes':path.stat().st_size})
Image.open('store/icon-512.png').convert('RGB').save(out/'icon-512.png')
assert Image.open(out/'icon-512.png').size==(512,512)
(root/'media.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# A review sheet is internal evidence, not a store screenshot.
thumbs=[]
for item in manifest:
 image=Image.open(out/item['file']);image.thumbnail((360,640));thumbs.append(image)
review=Image.new('RGB',(1800,1045),'#cad4d5')
for i,img in enumerate(thumbs):review.paste(img,((i%5)*360,(i//5)*660))
review.save(root/'review.jpg',quality=92)

"""Render exact research fixtures, not an application screenshot. Requires Pillow."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
data = json.loads((root/'notebook/data/fixtures.json').read_text())
tasks = {t['id']: t for t in data['tasks']}
font_root = Path('/usr/share/fonts/truetype/dejavu')
def font(n, bold=False):
    return ImageFont.truetype(str(font_root/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')), n)

W, H = 1320, 728
im = Image.new('RGB', (W,H), '#F6F4EF')
d = ImageDraw.Draw(im)
ink, muted = '#202C35', '#55616A'
d.text((52,35), 'Одинаковый размер — разный выбор', font=font(38, True), fill=ink)
d.text((54,91), 'В каждом поле 24 цифры и 16 допустимых первых пар', font=font(25), fill=muted)
cards=[('book-v1-70',52,'Том 3 · задача 22', ['Есть рискованный', 'первый ход'], '#B83D37'),
       ('book-v1-73',682,'Том 4 · задача 1', ['Все первые ходы', 'сохраняют решение'], '#1E7766')]
for task_id,x,subtitle,title,color in cards:
    t=tasks[task_id]; state=t['states'][0]
    assert len(state['alternatives']) == 16
    marked=set()
    if task_id.endswith('-70'):
        dead=[a for a in state['alternatives'] if a['status']=='NO_WIN_PROVEN']
        assert len(dead)==1
        marked={dead[0]['move']['a'],dead[0]['move']['b']}
    else:
        assert all(a['status']=='FOUND' for a in state['alternatives'])
    d.rounded_rectangle((x,143,x+586,619),radius=22,fill='white',outline='#DADFD9',width=2)
    d.text((x+25,163),subtitle, font=font(22),fill=muted)
    for line,y in zip(title,[202,240]):
        d.text((x+25,y),line,font=font(30,True),fill=color)
    cell, gap, sx, sy = 54, 5, x+30, 311
    for i,c in enumerate(t['board']):
        row,col=divmod(i,9); xx,yy=sx+col*(cell+gap),sy+row*(cell+gap)
        fill='#FCE4E0' if i in marked else '#F1F3EF' if c=='0' else '#FAFBF8'
        outline=color if i in marked else '#D4DBD3'
        d.rounded_rectangle((xx,yy,xx+cell,yy+cell),radius=8,fill=fill,outline=outline,width=3 if i in marked else 1)
        if c!='0':
            d.text((xx+cell/2,yy+cell/2),c,font=font(32,True),fill=color if i in marked else ink,anchor='mm')
    if marked:
        lines=['Отмеченные 6 + 6 снять можно.', 'Без «Отмены» победа недостижима.']
    else:
        lines=['После каждого из 16 первых ходов', 'найдено полное решение.']
    for line,y in zip(lines,[514,549]):
        d.text((x+27,y),line,font=font(23),fill=ink)
    d.text((x+27,588),task_id,font=font(16),fill=muted)
d.text((54,645),'Проверка первых ходов не означает, что любая дальнейшая игра выигрышна.',font=font(21),fill=muted)
d.text((54,682),'Исследовательская схема по точным полям df9ff5c · не экран приложения',font=font(19),fill=muted)
im.save(root/'figures/notebook-contrast.png',optimize=True)
print(root/'figures/notebook-contrast.png')

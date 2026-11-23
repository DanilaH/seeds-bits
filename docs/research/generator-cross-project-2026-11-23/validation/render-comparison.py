"""Exact research diagram, not a game screenshot. Recreate from matched fixtures."""
import json
from pathlib import Path
from html import escape

root = Path(__file__).resolve().parent
source = root / 'baseline-matched.json'
if source.exists():
    data = json.loads(source.read_text())
    fields = next(x['fields'] for x in data['matches'] if x['name'] == 'same_start_and_witness_length_different_reveal')
else:
    data = json.loads((root / 'matched-fixtures.json').read_text())
    fields = [next(x for x in data['fields'] if x['seed'] == seed) for seed in (24, 371)]

parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="700" viewBox="0 0 1160 700">',
         '<rect width="1160" height="700" fill="#f5f2ea"/>',
         '<style>text{font-family:DejaVu Sans,Arial,sans-serif;fill:#25372d} .muted{fill:#5a6a60} .num{font-size:25px;font-weight:600}</style>']
def text(x,y,value,size=18,**attrs):
    options=' '.join(f'{k.replace("_","-")}="{escape(str(v))}"' for k,v in attrs.items())
    parts.append(f'<text x="{x}" y="{y}" font-size="{size}" {options}>{escape(str(value))}</text>')
text(44,49,'28 цифр и 22 пары на старте. Два разных развития.',27,font_weight=700)
text(44,80,'Обычная классика · одинаковый состав цифр · реальные поля текущего генератора',18,class_='muted')
for col,field in enumerate(fields):
    x=44+col*554; color=['#315e4b','#775434'][col]
    parts.append(f'<rect x="{x}" y="111" width="518" height="478" rx="18" fill="#fffefa"/>')
    text(x+24,149,f'Seed {field["seed"]}',23,font_weight=700)
    text(x+24,177,'Проверенный путь: 17 снятий пар + 1 «Добавить»',15,class_='muted')
    for index,value in enumerate(field['board']):
        bx=x+24+(index%9)*51; by=203+(index//9)*51
        parts.append(f'<rect x="{bx}" y="{by}" width="46" height="46" rx="8" fill="#eeefe5"/>')
        text(bx+23,by+32,value,25,text_anchor='middle',font_weight=600)
    metrics=field['metrics']
    parts.append(f'<path d="M{x+24},426 H{x+494}" stroke="#dcded3"/>')
    text(x+24,460,'Новые пары после снятий',18)
    text(x+472,464,metrics['newlyEnabledPairsAfterRemoval'],30,text_anchor='end',font_weight=700,fill=color)
    text(x+24,505,'Ходы через пустые клетки',18)
    text(x+472,509,metrics['throughEmptyCellsMoves'],30,text_anchor='end',font_weight=700,fill=color)
    text(x+24,553,'«Добавить» после 11-го снятия в обоих полях',15,class_='muted')
text(44,624,'Считаем появление связей на одном проверенном пути, сохраняя ID клеток при сжатии.',17)
text(44,650,'Это различие структуры. Как оно ощущается игроком, ещё предстоит проверить.',17)
text(44,679,'Исследовательская схема, не скриншот игры · seeds-bits @ 0c8fbba · 23 ноября 2026',14,class_='muted')
parts.append('</svg>')
svg='\n'.join(parts).replace('class-=', 'class=')+'\n'
(root/'comparison.svg').write_text(svg)
try:
    import cairosvg
    cairosvg.svg2png(bytestring=svg.encode(),write_to=str(root/'comparison.png'))
except ImportError:
    pass

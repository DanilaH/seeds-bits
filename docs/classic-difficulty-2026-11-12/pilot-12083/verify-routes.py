import gzip
import json
from collections import Counter
from itertools import combinations
from pathlib import Path
import sys

def pair(board, a, b):
    low, high = sorted((a, b))
    first, second = board[low], board[high]
    if low == high or not first or not second or first != second and first + second != 10:
        return False
    y0, x0 = divmod(low, 9)
    y1, x1 = divmod(high, 9)
    dy, dx = y1-y0, x1-x0
    step = 1 if dy == 0 else 9 if dx == 0 else (9 + (1 if dx > 0 else -1)) if dy == abs(dx) else 0
    return bool(step and all(board[i] == 0 for i in range(low + step, high, step))) or not any(board[low+1:high])

def apply(board, action):
    if action is None:
        assert any(board)
        assert not any(pair(board, i, j) for i, j in combinations((i for i, d in enumerate(board) if d), 2))
        return board + [d for d in board if d]
    a, b = action
    assert pair(board, a, b), (board, action)
    adjusted = list(board)
    adjusted[a] = adjusted[b] = 0
    return [v for row in (adjusted[i:i+9] for i in range(0,len(adjusted),9)) if any(row) for v in row]

counts = Counter()
def verify(entry):
    board = list(map(int, entry["board"]))
    assert sum(bool(d) for d in board) == entry["size"]
    for index, step in enumerate(entry["proof"]):
        for name in ("choice","earlyChoice"):
            choices = entry.get(name)
            if choices and choices["at"] == index:
                alt = choices["alternative"]
                assert len(set(step) & set(alt[0])) == 1
                other = board
                for move in alt:
                    other = apply(other,move)
                assert not other
                counts[(entry["variant"],name)] += 1
        board = apply(board, step)
    assert not board
    counts[(entry["variant"],"primary")] += 1

path = Path(sys.argv[1])
if path.suffix == ".gz":
    with gzip.open(path, "rt") as stream:
        for line in stream:
            verify(json.loads(line))
else:
    for entry in json.loads(path.read_text()):
        verify(entry)
print(dict(counts))

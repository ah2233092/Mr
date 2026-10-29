"""Timeline values shared with src/timeline.ts (keep in sync)."""
import json
import os

_here = os.path.dirname(os.path.abspath(__file__))
VO = json.load(open(os.path.join(_here, "../src/data/vo.json")))
LINES = VO["lines"]
WORDS = VO["words"]
DURATION = VO["duration"]


def word(line, idx):
    return [w for w in WORDS if w["line"] == line][idx]["start"]


def line_start(i):
    return LINES[i]["start"]


def line_end(i):
    return LINES[i]["end"]


def mid(a, b, bias=0.5):
    return line_end(a) + (line_start(b) - line_end(a)) * bias


BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
DROP = line_start(7) - 0.04
HIT = DROP + 72 * BEAT
END_CARD = HIT - 0.4

T_NEVER = word(1, 2)
TWIST = mid(1, 2, 0.5)
PROBLEMS = mid(3, 4, 0.55)
P_COVER = mid(4, 5, 0.55)
P_KEYWORDS = mid(5, 6, 0.6)
FREEZE = mid(6, 7, 0.52)
CLOSE = mid(13, 14, 0.5)
CTA = mid(15, 16, 0.55)


def beat_time(k):
    """Time of beat k on the grid anchored at the drop (k may be negative)."""
    return DROP + k * BEAT


if __name__ == "__main__":
    for k in ["T_NEVER", "TWIST", "PROBLEMS", "P_COVER", "P_KEYWORDS", "FREEZE", "DROP", "CLOSE", "CTA", "END_CARD", "HIT", "DURATION"]:
        print(f"{k:11s} {globals()[k]:7.3f}")
    print("close in beats after drop:", (CLOSE - DROP) / BEAT)

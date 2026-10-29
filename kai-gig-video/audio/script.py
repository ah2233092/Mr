"""Voiceover script.

Each line: (caption text, text sent to the TTS engine, pause after in seconds, speed).
Caption text is the exact script from the brief; the TTS text only differs where a
spelling helps pronunciation (A-plus, one thousand, Fiver).
`scene` marks the first line of each scene so the timeline can be cut on it.
"""

LINES = [
    # scene, caption, tts, pause_after, speed
    ("hook", "Your book could be perfect…", "Your book could be perfect...", 0.55, 0.96),
    (None, "and still never sell a single copy.", "and still, never sell a single copy.", 0.80, 0.86),
    ("twist", "Not because of your writing.", "Not because of your writing.", 0.32, 0.98),
    (None, "Because of everything around it.", "Because of everything around it.", 0.70, 0.93),
    ("problems", "A wrong margin gets it sent back.", "A wrong margin gets it sent back.", 0.34, 1.0),
    (None, "A weak cover gets it skipped.", "A weak cover gets it skipped.", 0.40, 1.0),
    (None, "The wrong keywords bury it on page fifty.", "The wrong keywords bury it on page fifty.", 0.85, 0.98),
    ("turn", "So I handle all of it, in one place.", "So I handle all of it, in one place.", 0.80, 0.93),
    ("publish", "I publish your book on Amazon KDP, Kindle, paperback and hardcover.",
     "I publish your book on Amazon K.D.P., Kindle, paperback and hardcover.", 0.50, 1.0),
    ("format", "I format it so Amazon KDP approves it, not sends it back.",
     "I format it so Amazon K.D.P. approves it, not sends it back.", 0.50, 1.0),
    ("cover", "I design a cover that makes readers stop scrolling.",
     "I design a cover that makes readers stop scrolling.", 0.50, 0.98),
    ("keywords", "I find the keywords that help readers find you on Amazon.",
     "I find the keywords that help readers find you on Amazon.", 0.50, 1.0),
    ("aplus", "And I build A+ Content that turns visitors into buyers.",
     "And I build A-plus Content that turns visitors into buyers.", 0.80, 0.98),
    ("proof", "I've published over 1,000 books on Amazon KDP, and I know what works.",
     "I've published over one thousand books on Amazon K.D.P., and I know what works.", 0.80, 0.97),
    ("close", "You wrote the book.", "You wrote the book.", 0.42, 0.93),
    (None, "Let me take care of everything else.", "Let me take care of everything else.", 0.85, 0.92),
    ("cta", "Before you hit upload on Amazon KDP, send me your book details.",
     "Before you hit upload on Amazon K.D.P., send me your book details.", 0.38, 0.98),
    (None, "Only here on Fiverr.", "Only here, on Fiver.", 0.0, 0.95),
]

LEAD_IN = 0.35   # the hook opens on an already-lit frame; voice starts almost at once
TAIL = 3.2       # end card hold after the last word

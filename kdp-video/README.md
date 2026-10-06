# Amazon KDP: motion graphics video

A ~4 minute 1080p explainer video in Urdu/Hindi: what Amazon KDP is, how a book gets published, and how much authors earn.
It has animated scenes, text overlays, word-highlighted captions, a neural voiceover, background music, and sound effects.

- `output/`: final video and YouTube thumbnail
- `script.py`: voiceover script (Devanagari for the voice, Roman Urdu captions)
- `template.html`: every scene and animation (HTML/CSS + Web Animations), synced to the voice timeline
- `tts.py`: voiceover generation (Kokoro offline TTS, voice `hm_omega`) and `build/timeline.json`
- `render.js`: deterministic frame-by-frame capture with Playwright
- `audio.py`: synthesized music, sound effects, and voice ducking

## Rebuild

```bash
pip install kokoro-onnx soundfile scipy numpy
npm install
# download kokoro-v1.0.onnx + voices-v1.0.bin from github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
./make.sh /path/to/models
```

To change the text or numbers, edit `script.py` and `template.html`, then run `./make.sh` again.
All timings follow the voice automatically.

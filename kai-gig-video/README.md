# KAI: Fiverr gig video

A 61-second, 1080p30 animated explainer for the KAI Amazon KDP publishing gig. It has a hook, a twist, three problems, the turn, five services, proof, an emotional close, and a call to action with an end card.

Every visual, the score, and every sound effect is original and made in this project. There is no stock footage, there are no samples, and there is nothing to license or attribute.

- `output/KAI_gig_video.mp4`: final video (H.264/AAC, −14 LUFS)
- `output/KAI_gig_thumbnail.png`: gig thumbnail, a still from the hook

## How it is built

| Part | Where | Tool |
| --- | --- | --- |
| Voiceover | `audio/script.py`, `audio/tts.py`, `audio/process_vo.sh` | Kokoro TTS (offline), American male voice blend `am_michael:0.7,am_fenrir:0.3`; ffmpeg chain (HPF 80 Hz, warmth, de-ess, 2.5:1 compression) |
| Word timings | `audio/align.py` → `src/data/vo.json` | Parakeet ASR (sherpa-onnx), mapped back onto the exact script words |
| Motion graphics | `src/` | Remotion (React) |
| Score | `audio/music.py` | composed in code, rendered with FluidSynth + MuseScore_General soundfont (MIT); drums synthesized; per-line side-chain ducking ~19 dB under the voice |
| Sound effects | `audio/sfx.py` → `public/sfx/` | 48 effects synthesized from scratch (numpy/scipy) |
| Master | `scripts/finish.sh` | ffmpeg two-pass loudnorm, x264 |

Every scene cut, caption, text animation and sound effect is keyed to the voiceover word timestamps in `src/data/vo.json`. If the voice changes, everything follows it.

### Source map

- `src/timeline.ts`: scene boundaries (cut in the pauses between lines), word lookups, music grid (104 BPM; the beat drop lands on "So" and the final hit on the end-card logo)
- `src/scenes/S1Hook.tsx` … `S8CTA.tsx`: one file per scene; each `<Sfx>` sits next to the animation it belongs to
- `src/components/`: KAI logo, CSS-3D book with computed lighting, original book covers, service icons, captions, kinetic type, UI mockups, grain/vignette/light leaks
- `src/captionPlan.ts`: where captions give way to full-screen kinetic type
- `src/layout.ts`: geometry shared across scenes for hand-off transitions

## Edit and re-render

```bash
npm install
npm run studio                 # live preview / scrub in the browser
npx remotion render KAIGigVideo build/video_raw.mp4 --crf=14 --audio-codec=aac --audio-bitrate=320k
scripts/finish.sh build/video_raw.mp4 132   # master + thumbnail (frame 132)
node scripts/stills.mjs build/qa 4.4 20.6   # render review stills at given seconds
```

Changing the voiceover text or voice needs the Kokoro and Parakeet models (GitHub releases `thewh1teagle/kokoro-onnx` model-files-v1.0 and `k2-fsa/sherpa-onnx` asr-models):

```bash
pip install kokoro-onnx sherpa-onnx soundfile scipy numpy mido pyloudnorm
cd audio
MODELS=/path/to/models python3 tts.py && ./process_vo.sh && MODELS=/path/to/models python3 align.py
python3 sfx.py && python3 music.py      # music re-ducks itself under the new voice
```

Remotion is free for individuals and companies of up to three people. Larger companies need a Remotion company license to render.

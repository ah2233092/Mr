import sherpa_onnx, soundfile as sf, json, sys
M = "/tmp/claude-0/-home-user-Mr/8b3acd91-59bb-5159-a8ad-a3fd737356c1/scratchpad/asr/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"
rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=f"{M}/encoder.int8.onnx", decoder=f"{M}/decoder.int8.onnx",
    joiner=f"{M}/joiner.int8.onnx", tokens=f"{M}/tokens.txt", model_type="nemo_transducer", num_threads=4)
a, sr = sf.read("audio16k.wav", dtype="float32")
st = rec.create_stream(); st.accept_waveform(sr, a); rec.decode_stream(st)
r = st.result
print(r.text)
# merge sentencepiece tokens into words with start times
words, cur, t0 = [], "", None
for tok, ts in zip(r.tokens, r.timestamps):
    if tok.startswith("▁") or tok.startswith(" "):
        if cur: words.append({"w": cur, "t": round(t0, 2)})
        cur, t0 = tok.lstrip("▁ "), ts
    else:
        if t0 is None: t0 = ts
        cur += tok
if cur: words.append({"w": cur, "t": round(t0, 2)})
json.dump(words, open("words.json", "w"), indent=0)
print(" ".join(f"{w['w']}@{w['t']}" for w in words))

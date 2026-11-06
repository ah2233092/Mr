# ChatGPT (personal) — apna multi-model AI chat

Aapka apna, **personal** ChatGPT jaisa app: wohi look, apna backend engine, login, model menu mein
**sab se upar asli ChatGPT models** (GPT-6.x, GPT-5.x, o-series), free fast models, image generation,
aur desktop + mobile par **install hone wala app** (PWA). App ki taraf se **koi limit nahi**.

> Yeh sirf personal use ke liye set hai: `.env` mein `ALLOWED_EMAILS` mein apni email daalein,
> phir koi aur sign up ya login nahi kar sakta.

---

## Kya kya hai

**Chat (ChatGPT jaisa)**
- Live streaming jawab (token-by-token), Stop button, Regenerate, message Edit
- Markdown, tables, syntax-highlighted code + "Copy code", math formulas (KaTeX)
- "Thinking…" panel jo reasoning models ki soch dikhata hai
- Chat history: din ke hisaab se groups, search, rename, pin, delete, export
- Images upload (vision models dekh kar jawab dete hain), PDF / text / code files attach
- Voice typing (mic), "Read aloud", copy, 👍/👎
- Custom instructions ("Customize"), light / dark / system theme
- Roman Urdu mein poocho to Roman Urdu mein jawab

**Model menu (order)**
1. **ChatGPT models** — OpenAI API key se: GPT-6.1 Sol, GPT-6 Sol/Luna/Astra, GPT-5.x, o3 …
   (jo models aapki key par available hain, woh khud aa jaate hain; naya model aaye to khud dikhega)
2. **Auto** — sab se tez free model
3. **OpenAI open models · Free** — GPT-OSS 120B / 20B (OpenAI ke banaye hue, Cerebras/Groq par free)
4. Baqi providers: Gemini, Llama, Qwen, DeepSeek, Mistral …

- Default model: sab se naya ChatGPT model (`DEFAULT_MODEL` se badal sakte hain)
- Har jawab ke neeche **asli model ka naam**. Agar chuna hua model us waqt available na ho to
  agla model jawab deta hai aur upar note aata hai: *"GPT-6.1 Sol wasn't available right now, so … answered."*

**Images**
- "Create image" tool ya bas likho: *"create an image of…"* / *"ek sher ki tasveer banao"*
- Prompt pehle AI se behtar banaya jata hai → behtar tasveerein; Library mein saari tasveerein

**Login**
- Email + password (scrypt hashing, secure httpOnly cookies), "Continue with Google",
  password reset email, brute-force protection, **private mode** (`ALLOWED_EMAILS`)

**Engine**
- Har provider ki apni queue taake rate-limit na lage; 100–200 log ek saath bhi chala sakte hain
- Circuit breaker: jo model/provider fail ho use kuch der skip karta hai — intezar nahi
- Fallback: ChatGPT model fail ho to pehle doosra ChatGPT model, phir free fast models
- Admin panel: usage, providers ka load, cooling-down models

---

## ⚠️ Zaroori baatein

1. **ChatGPT models (GPT-6 / GPT-5) OpenAI ki paid API se chalte hain.** `OPENAI_API_KEY` lagayein,
   OpenAI account mein credit daalein. Har message ka kharcha aapke OpenAI account se katega. App mein koi
   limit nahi, is liye **OpenAI dashboard → Settings → Limits mein monthly budget zaroor set karein**.
   Bina OpenAI key ke bhi app chalega: free models (GPT-OSS, Gemini, Llama…) se.

2. **"Unlimited" sirf app ki taraf se hai.** Free providers (Cerebras, Groq, Gemini…) ki apni
   per-minute/per-day limits hoti hain. Engine unhein khud sambhalta hai (busy ho to doosra model).

3. **Personal rakhein.** `ALLOWED_EMAILS` mein sirf apni email daalein. Is naam ke saath public sign-up
   wali site mat chalayein. Logo maine original rakha hai (OpenAI ka logo copy nahi kiya); `public/` mein
   apna logo/icon badalna ho to badal sakte hain.

4. **Purani `index.html` ki 34 Gemini API keys khuli padi thin** — https://aistudio.google.com/apikey par
   ja kar delete/revoke kar dein. Naye app mein keys sirf server par rehti hain.

---

## API keys kahan se lein

| Provider | Kya milta hai | Link |
|---|---|---|
| **OpenAI** (paid) | ChatGPT models: GPT-6.x, GPT-5.x, o-series | https://platform.openai.com/api-keys |
| **Cerebras** (free) | Sab se tez — GPT-OSS 120B, Llama, Qwen | https://cloud.cerebras.ai |
| **Groq** (free) | Bohat tez — GPT-OSS 120B/20B, Llama 3.3 70B, Llama 4 | https://console.groq.com/keys |
| **Google Gemini** (free) | Smart, images samajhta hai | https://aistudio.google.com/apikey |
| **OpenRouter** (free models) | Bohat saare `:free` models | https://openrouter.ai/keys |
| **Mistral** (free plan) | Mistral models | https://console.mistral.ai/api-keys |
| **Cloudflare Workers AI** (free quota) | FLUX images | https://dash.cloudflare.com → AI → Workers AI |

Best setup: **OpenAI + Cerebras + Groq + Gemini** (ChatGPT models upar, aur fallback ke liye tez free models).

---

## Apne computer par chalana

Node.js **22.13+** chahiye (koi `npm install` nahi — server ki zero dependencies hain).

```bash
cd chat-app
cp .env.example .env      # keys + ALLOWED_EMAILS likhein
node server/index.js      # http://localhost:3000
```

Bina kisi key ke UI dekhna ho to: `ENABLE_MOCK=1 node server/index.js` (nakli AI, sirf testing).

```bash
npm test                  # integration tests
npm run loadtest          # 100 users ek saath (mock AI)
```

---

## Online deploy (taake phone par bhi chale)

### Option A — VPS (~$5/mahina, recommended)
1. Hetzner / DigitalOcean / Contabo par Ubuntu server, Docker install.
2. Domain ka **A record** server ke IP par.
3. Server par:
   ```bash
   git clone <your-repo> && cd <repo>/chat-app
   cp .env.example .env && nano .env      # keys + DOMAIN + PUBLIC_URL + ALLOWED_EMAILS + ADMIN_EMAILS
   docker compose up -d --build
   ```
   Caddy khud HTTPS laga dega. Data `appdata` volume mein safe rehta hai.

### Option B — Railway / Render
- GitHub repo connect, **Root directory = `chat-app`**, Dockerfile se build.
- Ek **volume/disk** `/data` par mount karein. `.env.example` wale variables dashboard mein.
  Health check: `/healthz`.

Google login: Google Cloud Console mein redirect URI `https://YOUR-DOMAIN/api/auth/google/callback`.

---

## App install karna (desktop + mobile)

- **Android (Chrome):** site kholo → "Install app" (ya sidebar mein *Install app*).
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Windows / Mac (Chrome, Edge):** address bar mein install icon → app apni window mein khulta hai.

---

## Engine kaise kaam karta hai

```
Browser ──SSE stream──▶ /api/chat
                          ▼
                    candidatesFor(model)  ← registry: discovered models (ChatGPT first), ranked,
                          │                 cooldowns (circuit breaker)
                          ▼
                    provider queue (fair FIFO per provider)
                          ▼
             OpenAI-compatible stream (OpenAI / Cerebras / Groq / Gemini / OpenRouter / …)
                          │  429 / 5xx / timeout / bad key → cooldown + next model
                          ▼
                    tokens batched every 30 ms → browser; reply + real model name saved (SQLite)
```

- `server/engine/providers.js` — providers, streaming, model naming/ranking
- `server/engine/registry.js` — model discovery, menu order, Auto order, queues, cooldowns
- `server/engine/engine.js` — fallback ke saath generation
- `server/engine/images.js` — image back-ends, prompt enhancer, intent detection
- `server/routes/chat.js` — chat endpoint (send / regenerate / edit, vision, files, titles)
- `server/routes/api.js` — auth, account, chats, search, files, admin
- `public/` — frontend (vanilla JS, koi build step nahi), PWA manifest + service worker

**Load test** (`npm run loadtest`, mock AI): 100 users ek saath × 2 rounds → **100/100 OK** dono rounds
(~2.2s mein sab ke poore jawab); 200 users ek saath → **200/200 OK** (0.9s, ~210 MB memory).

---

## Aham settings (`.env`)

- `APP_NAME` — app ka naam (default **ChatGPT**)
- `ALLOWED_EMAILS` — sirf yeh emails login kar sakti hain (private mode)
- `ADMIN_EMAILS` — Admin panel
- `DEFAULT_MODEL` — default model, masalan `openai:gpt-6.1-sol`
- `OPENAI_MODELS` — OpenAI models ki fixed list (warna khud discover hoti hai)
- `USER_*` limits — sab `0` = unlimited (default)
- `IMAGE_PROVIDERS` — image back-ends ka order

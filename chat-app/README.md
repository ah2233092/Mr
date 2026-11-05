# Sukhan AI — free multi-model AI chat (ChatGPT jaisa look)

Ek mukammal AI chat app: ChatGPT jaisa interface, apna backend engine, login system, bohat saare
AI models, image generation, aur desktop + mobile par **install hone wala app** (PWA).

> App ka naam `APP_NAME` se badal sakte hain. Logo original hai (neeche "Zaroori baatein" parhein).

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

**Models**
- Har provider ke models **khud-ba-khud** list ho jaate hain — jo key lagao uske models aa jaate hain
- **Auto** mode: sab se tez free model chunta hai; agar woh busy ho to agle par chala jata hai
- Har jawab ke neeche **asli model ka naam** likha hota hai (koi fake label nahi)

**Images**
- "Create image" tool ya bas likho: *"create an image of…"* / *"ek sher ki tasveer banao"*
- Prompt pehle AI se behtar banaya jata hai (ChatGPT bhi yehi karta hai) → behtar tasveerein
- Shakal (square / wide / portrait) khud samajh leta hai; Library mein saari tasveerein

**Login**
- Email + password (scrypt hashing, secure httpOnly cookies), "Continue with Google",
  password reset email, brute-force protection, account delete

**Engine (100+ users ek saath)**
- Har provider ki apni queue (fair line) taake rate-limit na lage
- Circuit breaker: jo model fail/busy ho use kuch der skip karta hai — user ko intezar nahi
- Fallback: ek model fail ho to agla model jawab deta hai, aur yeh UI mein saaf likha hota hai
- Per-user fair limits (daily messages, premium messages, images, per-minute)
- Admin panel: users, aaj ke messages, providers ka load, cooling-down models

---

## ⚠️ Zaroori baatein (pehle yeh parhein)

1. **GPT-6 / GPT-5.x free nahi diye ja sakte.** OpenAI ke yeh models sirf paid API se milte hain.
   App inhein support karta hai: `OPENAI_API_KEY` lagao to aapki key jin models tak pohanchti hai
   (masalan `gpt-6-sol`, `gpt-6-astra`, `gpt-5.1` …) woh **apne asli naam** se list mein aa jaayenge.
   Kharcha owner (aap) ka hoga, is liye har user ko roz ke **Premium** messages ki limit milti hai
   (`USER_PAID_MSGS_PER_DAY`). **Free "GPT"** bhi hai: OpenAI ke open models **GPT-OSS 120B / 20B**
   Cerebras aur Groq par free chalte hain — yeh Auto mein sab se pehle hain.

2. **Fake model naam nahi.** Purani file "GPT-5.6" dikhati thi lekin andar Gemini chal raha tha —
   yeh users se jhoot hai. Naye app mein hamesha woh naam dikhta hai jo asal mein jawab de raha hai.

3. **ChatGPT ka naam aur logo OpenAI ka trademark hai.** Wohi logo/naam lagane se app band ho sakti hai,
   domain/hosting suspend ho sakti hai, Play Store reject karta hai. Is liye look-and-feel ChatGPT jaisa hai
   lekin logo apna (knot design) aur naam "Sukhan AI" hai — `APP_NAME` se jo chahein rakh lein.

4. **Purani `index.html` mein 34 Gemini API keys khuli padi thin.** Koi bhi "View source" karke chura
   sakta hai. **Abhi https://aistudio.google.com/apikey par ja kar yeh sab keys delete/revoke karein.**
   Free limit barhane ke liye bohat saari free keys banana Google ki terms ke khilaf hai (account ban ho
   sakta hai). Naye app mein keys sirf server par rehti hain, browser tak kabhi nahi jaatin.

5. **100 users:** server khud 100–200 users ek saath aaram se chalata hai (neeche test results).
   Asal hadd AI providers ki free limits hain. Jitne zyada providers ki keys lagayenge, utna zyada
   load bant jayega. Bohat zyada traffic ho to Groq/Cerebras ke sastay paid tiers best hain.

---

## Free API keys kahan se lein (5 minute)

| Provider | Kya milta hai | Link |
|---|---|---|
| **Cerebras** | Sab se tez jawab — GPT-OSS 120B, Llama, Qwen | https://cloud.cerebras.ai |
| **Groq** | Bohat tez — GPT-OSS 120B/20B, Llama 3.3 70B, Llama 4 (images bhi dekhta hai) | https://console.groq.com/keys |
| **Google Gemini** | Smart, images samajhta hai | https://aistudio.google.com/apikey |
| **OpenRouter** | Bohat saare `:free` models | https://openrouter.ai/keys |
| **Mistral** | Free "Experiment" plan | https://console.mistral.ai/api-keys |
| **Cloudflare Workers AI** | FLUX images, roz free quota | https://dash.cloudflare.com → AI → Workers AI |

Kam az kam **Cerebras + Groq + Gemini** lagayein — teen providers = tez + reliable.
Free limits providers badalte rehte hain; unke pages par check kar lein.

---

## Apne computer par chalana

Node.js **22.13+** chahiye (koi `npm install` nahi — server ki zero dependencies hain).

```bash
cd chat-app
cp .env.example .env      # phir .env mein keys likhein
node server/index.js      # http://localhost:3000
```

Bina kisi key ke UI dekhna ho to: `ENABLE_MOCK=1 node server/index.js` (nakli AI, sirf testing).

Tests aur load test:

```bash
npm test                  # 8 integration tests
npm run loadtest          # 100 users ek saath (mock AI)
```

---

## Online deploy (live website)

### Option A — VPS (sab se sasta, recommended): ~$5/mahina
1. Hetzner / DigitalOcean / Contabo par Ubuntu server lein, Docker install karein.
2. Apne domain ka **A record** server ke IP par point karein.
3. Server par:
   ```bash
   git clone <your-repo> && cd <repo>/chat-app
   cp .env.example .env && nano .env      # keys + DOMAIN + PUBLIC_URL + ADMIN_EMAILS
   docker compose up -d --build
   ```
   Caddy khud HTTPS certificate laga dega. Data `appdata` volume mein safe rehta hai.

### Option B — Railway / Render
- GitHub repo connect karein, **Root directory = `chat-app`**, Dockerfile se build.
- Ek **volume/disk** `/data` par mount karein (warna restart par data mit jayega).
- `.env.example` wale variables dashboard mein daalein. Health check path: `/healthz`.

Google login ke liye Google Cloud Console mein redirect URI: `https://YOUR-DOMAIN/api/auth/google/callback`.

---

## App install karna (desktop + mobile)

- **Android (Chrome):** site kholo → "Install app" (ya sidebar mein *Install app*).
- **iPhone (Safari):** Share button → *Add to Home Screen*.
- **Windows / Mac (Chrome, Edge):** address bar mein install icon → app apni window mein khulta hai.
- **Play Store par daalna ho:** https://www.pwabuilder.com par apni site ka URL daalein → Android package
  (.aab) download → Play Console par upload.

---

## Engine kaise kaam karta hai

```
Browser ──SSE stream──▶ /api/chat
                          │ user limits (per-minute, daily, premium, concurrent)
                          ▼
                    candidatesFor(model)  ← registry: discovered models, ranked
                          │                 cooldowns (circuit breaker)
                          ▼
                    provider queue (Semaphore, fair FIFO, per provider)
                          │
                          ▼
             OpenAI-compatible stream (Cerebras / Groq / Gemini / OpenRouter / OpenAI / …)
                          │  429 / 5xx / timeout → cooldown + next model
                          ▼
                    tokens batched every 30 ms → browser
                    reply + real model name saved in SQLite (WAL)
```

- `server/engine/providers.js` — providers ki list, streaming, model naming/ranking
- `server/engine/registry.js` — model discovery, Auto order, queues, cooldowns
- `server/engine/engine.js` — fallback ke saath generation
- `server/engine/images.js` — image back-ends, prompt enhancer, intent detection
- `server/routes/chat.js` — chat endpoint (send / regenerate / edit, vision, files, titles)
- `server/routes/api.js` — auth, account, chats, search, files, admin
- `public/` — frontend (vanilla JS, koi build step nahi), PWA manifest + service worker

### Load test (is repo ke `npm run loadtest` se, mock AI ~50 tokens/sec)

| Test | Result |
|---|---|
| 100 users ek saath, 2 rounds, provider queue 32 | **100/100 OK** dono rounds, ~2.2s mein sab ke poore jawab |
| 200 users ek saath, bina queue limit | **200/200 OK**, 0.9s, server memory ~210 MB |

Yeh server ki capacity hai; real speed us provider par depend karti hai jo jawab de raha hai.

---

## Settings (`.env`)

Saari settings `.env.example` mein comments ke saath hain. Kuch aham:

- `APP_NAME` — app ka naam (UI + installed app)
- `ADMIN_EMAILS` — in emails ko Admin panel milta hai
- `AUTO_MODELS` — Auto ka order khud set karein
- `FEATURED_MODELS` — model menu mein "Recommended"
- `USER_MSGS_PER_DAY`, `USER_PAID_MSGS_PER_DAY`, `USER_IMAGES_PER_DAY` — fair-use limits
- `PROVIDER_CONCURRENCY` — ek provider ko ek waqt mein kitni requests jaayein
- `IMAGE_PROVIDERS` — image back-ends ka order

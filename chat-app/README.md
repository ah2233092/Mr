# ChatGPT Pro — personal website

Aapki apni ChatGPT jaisi **website**: wahi look, model menu mein ChatGPT wale naam
(GPT-6.1 Sol, GPT-6 Astra, GPT-6 Sol, GPT-6 Luna, GPT-5.1, GPT-4o). Har naam ke peeche OmniRoute ke
free models chalte hain — ek fail ho to agla. Reply ke neeche naam par mouse rakhein to asli model dikhta hai.

## ▶️ Website chalana (apne PC par)
1. **Releases → "ChatGPT Pro (website)"** se `ChatGPT-Pro-Website.zip` download karke unzip karein.
2. Windows: **`Start-ChatGPT-Pro.bat`** double-click · Mac/Linux: `start-chatgpt-pro.sh`.
3. Browser khud **http://localhost:3000** kholega → Sign up → chat.

OmniRoute isi PC par chal raha ho (`localhost:20128`) to website khud jud jati hai. OmniRoute dashboard mein
free providers (Groq, Gemini, Cerebras, OpenRouter, Cloudflare images) connect karein.
Phone se: profile menu → **Open on phone** wala address phone ke browser mein kholein (same Wi-Fi).
Asli model naam dekhne hon to `MODEL_ALIASES=off`.

---

## 🚀 Sab se aasaan tareeqa — koi password ya file edit nahi

### 1) PC app (Windows / Mac / Linux) — sirf download karein
1. GitHub par repo → **Releases** → **"Sukhan AI Pro (PC + Android)"** → apne computer wali file download karein:
   - Windows: `Sukhan-AI-Pro-Setup-1.0.0.exe` (agar "Windows protected your PC" aaye: *More info → Run anyway*)
   - Mac: `Sukhan-AI-Pro-1.0.0-arm64.dmg` (M1/M2/M3…) ya `-x64.dmg` (Intel) → Applications mein daalein → right-click → Open
   - Linux: `Sukhan-AI-Pro-1.0.0.AppImage`
2. App kholein → **Sign up** (pehla account khud **admin** ban jata hai).
3. Bas — chat shuru. App aapke PC par chal rahe **OmniRoute** (`localhost:20128`) se khud jud jati hai —
   koi key ya setting app mein nahi. OmniRoute mein jo providers connect honge (Groq, Gemini, Cerebras…)
   unke models menu mein khud aa jaate hain (har 5 minute mein list update hoti hai).

### 📱 Android app
Releases page se **`Sukhan-AI-Pro-Android.apk`** phone par download karke kholein (pehli dafa "Install unknown apps"
allow karna hoga). App pehli dafa aapki app ka address poochti hai (ek hi dafa) — address PC app mein
**profile menu → Phone app** par likha hota hai. iPhone: wahi address Safari mein kholein → Share →
**Add to Home Screen**. Phone ko PC app (same Wi-Fi) ya online server chahiye — neeche wala server (option 2).

### 2) Phone + PC dono par, hamesha online — ek command
Ek sasta VPS lein (Ubuntu, ~$5/mahina). Server par yeh 2 commands:
```bash
git clone https://github.com/ah2233092/Mr.git && cd Mr && git checkout claude/wizardly-shannon-hklz40
```
```bash
cd chat-app && sudo bash install.sh
```
Installer khud: Docker install karta hai, saare passwords/secrets banata hai, **domain ke bina HTTPS link**
deta hai (`https://1-2-3-4.sslip.io`), OmniRoute chalata hai aur us ki key bhi khud jodta hai.
Aakhir mein link print hota hai → phone aur PC par kholein → Sign up → chat.
Phone par app: Android (Chrome) ⋮ → **Install app** · iPhone (Safari) Share → **Add to Home Screen**.

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
  password reset email, brute-force protection

**Engine (OmniRoute se powered)**
- Backend ka main engine **OmniRoute** hai (ek gateway jo bohat saare AI providers ko ek jagah jodta hai);
  interface wahi rehta hai — model ke naam, menu, sab kuch same
- OmniRoute band ho jaye to direct keys (Cerebras/Groq…) **backup** ban kar jawab dete hain — chat kabhi nahi rukti
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

3. **Logo** maine original rakha hai (OpenAI ka logo copy nahi kiya); `public/` mein apna logo/icon
   badalna ho to badal sakte hain.

4. **Purani `index.html` ki 34 Gemini API keys khuli padi thin** — https://aistudio.google.com/apikey par
   ja kar delete/revoke kar dein. Naye app mein keys sirf server par rehti hain.

---

## OmniRoute setup (main engine)

OmniRoute aapke server par app ke saath hi chalta hai (`docker compose` dono ko start karta hai).
Maine OmniRoute **3.8.52** asal mein chala kar check kiya hai.

1. `install.sh` sab kuch khud set karta hai (password, secrets, OmniRoute API key). Dashboard kholna ho to
   apne PC se SSH tunnel:
   ```bash
   ssh -L 20128:localhost:20128 root@YOUR_SERVER_IP
   ```
   Browser mein `http://localhost:20128` → password installer ne aakhir mein print kiya tha (`chat-app/.env` mein
   `OMNIROUTE_DASHBOARD_PASSWORD`).
2. App OmniRoute se **khud** judti hai: agar OmniRoute key maange to app dashboard mein login karke apni key khud
   bana leti hai (`OMNIROUTE_PASSWORD`, warna OmniRoute ka default password). Dashboard password badla hai to
   server ki `.env` (desktop app: `config.env`, neeche dekhein) mein `OMNIROUTE_PASSWORD=` likh dein.
3. OmniRoute dashboard mein providers connect karein — **apni official API keys se** (Cerebras, Groq, Gemini,
   OpenRouter, Cloudflare AI, OpenAI…). Neeche table mein links hain.
4. Images: dashboard se kisi official image provider (Cloudflare AI / Together / Pollinations FLUX…) ke model
   connect karein — app khud ek official image model (FLUX ko pehle) chun leti hai.
5. **Backup (optional):** server ki `.env` mein `CEREBRAS_API_KEY` / `GROQ_API_KEY` bhi daal sakte hain —
   OmniRoute kabhi band ho to app in se jawab deti rahegi.

Kaise kaam karta hai:
- Model menu: OmniRoute ke models apne **asli naam** aur asli provider ke saath aate hain
  (`openai/gpt-6.1-sol` → "GPT-6.1 Sol" ChatGPT group mein, `groq/llama-3.3-70b` → "Groq · Free").
- **Auto** = app ka apna engine, OmniRoute ke official models mein se sab se tez wala chunta hai
  (masalan Cerebras ka GPT-OSS 120B). Jawab ke neeche asli model ka naam aata hai.
- OmniRoute start hone mein der kare to app thodi der baad khud dobara model list le leta hai.

⚠️ **Sirf official API wale providers use hote hain.** OmniRoute bina kisi key ke bhi bohat se "free" models
dikhata hai — jaise GPT-6 Astra, GPT-5.6, Claude — jo DuckDuckGo web chat, Devin CLI, Codex app,
Cloudflare playground, g4f waghera ke raste chalte hain. Yeh un services ki terms ke khilaf hai (OmniRoute
khud DuckDuckGo wale ko "avoid" kehta hai), kabhi bhi band ho sakte hain aur accounts ban ho sakte hain. Is liye
app inhein **na list karta hai na un par bhejta hai**, aur OmniRoute ke apne `auto/*` combos bhi istemal nahi
karta (woh in raston par ja sakte hain). OmniRoute ke "stealth"/fingerprint features bhi on na karein.
Koi aur **official** API provider jodna ho to: `OMNIROUTE_ALLOW_PROVIDERS=provider-id`.

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

Yeh keys OmniRoute dashboard mein connect karein (Cerebras + Groq ko `.env` mein bhi backup ke liye daalein).

**Sab se behtar FREE setup:**
- **Chat (tez):** Cerebras + Groq → GPT-OSS 120B, Llama — sab se tez jawab
- **Chat (smart + images samajhna):** Google Gemini
- **Images:** Cloudflare Workers AI (FLUX, roz free quota) — Pollinations bina key ke pehle se on hai
- **ChatGPT models (GPT-6 / GPT-5):** sirf OpenAI key se (paid) — koi free official tareeqa nahi hai

---

## Apne computer par chalana

Node.js **22.13+** chahiye (koi `npm install` nahi — server ki zero dependencies hain).

```bash
cd chat-app
cp .env.example .env      # keys likhein
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
   cp .env.example .env && nano .env      # DOMAIN + PUBLIC_URL + ADMIN_EMAILS + OmniRoute secrets + backup keys
   docker compose up -d --build
   ```
   Teen cheezein chalti hain: **app**, **OmniRoute**, **Caddy** (HTTPS). Teeno band hon to khud restart.
   Phir upar "OmniRoute setup" wale steps karein. Chats `appdata` volume mein safe rehti hain, aur app
   roz database ka backup `data/backups/` mein rakhta hai (aakhri 7 din).

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
- `desktop/` — Electron desktop app (server isi ke andar chalta hai); GitHub Actions installers banata hai
- `install.sh` — VPS ka one-command installer
- `server/engine/omniroute.js` — OmniRoute se khud judna (key khud banana)
- `server/settings.js` — backend settings jo app khud save karti hai (UI mein kuch nahi)

**Desktop app ki backend settings (optional):** `config.env` file — Windows: `%APPDATA%\Sukhan AI Pro\config.env`,
Mac: `~/Library/Application Support/Sukhan AI Pro/config.env`, Linux: `~/.config/Sukhan AI Pro/config.env`.
Masalan `OMNIROUTE_PASSWORD=...` ya `OMNIROUTE_BASE_URL=http://my-server:20128/v1`.

**Load test** (`npm run loadtest`, mock AI): 100 users ek saath × 2 rounds → **100/100 OK** dono rounds
(~2.2s mein sab ke poore jawab); 200 users ek saath → **200/200 OK** (0.9s, ~210 MB memory).
OmniRoute ke raste (`VIA=omniroute npm run loadtest`, fake gateway): 100 users × 2 rounds → **100/100 OK**,
pehla word ~0.13–0.27s, poora jawab ~1s.

---

## Aham settings (`.env`)

- `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY` — OmniRoute connection (compose mein base URL khud set hai)
- `OMNIROUTE_IMAGE_MODEL` — OmniRoute ka image model
- `OMNIROUTE_AUTO_MODELS` — (optional) apna OmniRoute combo (sirf official providers) jo Auto pehle try kare
- `OMNIROUTE_ALLOW_PROVIDERS` — OmniRoute ke aur official API providers allow karein

- `APP_NAME` — app ka naam (default **Sukhan AI Pro**)
- `ADMIN_EMAILS` — Admin panel
- `DEFAULT_MODEL` — default model, masalan `openai:gpt-6.1-sol`
- `OPENAI_MODELS` — OpenAI models ki fixed list (warna khud discover hoti hai)
- `USER_*` limits — sab `0` = unlimited (default)
- `IMAGE_PROVIDERS` — image back-ends ka order

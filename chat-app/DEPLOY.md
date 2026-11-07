# ChatGPT Pro ko live karna (internet par)

Live hone ke baad ek link milega — usay **phone aur PC dono** par kahin se bhi kholein.
**Sign up** sab ke liye khula hai; **pehla account admin** banta hai.

AI ke liye kam az kam **ek free key** chahiye (2 minute, apne account se):
Groq → https://console.groq.com/keys · Gemini → https://aistudio.google.com/apikey ·
Cerebras → https://cloud.cerebras.ai · OpenRouter → https://openrouter.ai/keys
Images bina key ke bhi bante hain.

---

## A) Render — free, sab se aasaan

1. https://render.com par account banayein (Google se login).
2. **New → Web Service → Public Git Repository** mein likhein: `https://github.com/ah2233092/Mr` → **Connect**.
3. Yeh bharein:
   - **Branch:** `claude/wizardly-shannon-hklz40`
   - **Root Directory:** `chat-app`
   - **Language:** Docker
   - **Instance Type:** Free
4. **Environment Variables** mein apni key daalein, masalan `GROQ_API_KEY` = *aapki key*
   (aur `GEMINI_API_KEY`, `CEREBRAS_API_KEY` bhi daal sakte hain — jitni zyada, utna behtar).
5. **Deploy** dabayein. 3–5 minute baad link milega: `https://<naam>.onrender.com` — **yahi aapki website hai.**

Free plan: 15 minute koi na chalaye to so jata hai (agla page ~1 minute mein khulta hai), aur restart par
accounts/chats mit sakte hain. Hamesha ke liye data chahiye to Render mein **Disk** add karein, mount path `/data`.

## B) Railway — aasaan, data mehfooz (~$5/mahina)

1. https://railway.com → **New Project → Deploy from GitHub repo** → `ah2233092/Mr`.
2. Service **Settings**: Root Directory `chat-app`, Branch `claude/wizardly-shannon-hklz40`.
3. **Variables** mein apni AI key(s) daalein.
4. Service par **right-click → Attach Volume**, mount path `/data`.
5. **Settings → Networking → Generate Domain** → link mil jayega.

## C) Apna server (VPS) — sab se mazboot, OmniRoute ke saath

Ubuntu server par is folder ko upload karein (ya `git clone`), phir:
```bash
sudo bash install.sh
```
Sab automatic: HTTPS link (domain ke bina bhi), OmniRoute, passwords. Free providers OmniRoute dashboard mein jodein.

---

**Sirf apne liye rakhna ho:** apna account banane ke baad service ki settings mein `ALLOW_SIGNUP=false` daal dein.

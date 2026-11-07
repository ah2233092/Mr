/* ================= ChatGPT — settings =================
 * The page works without any key (free Pollinations AI + images).
 * Optional: add FREE keys for faster / smarter answers. The page tries them in order and
 * falls back to the next one if a provider fails.
 * WARNING: anything written here can be read by anyone who opens the page source,
 * so only use free keys that have no billing attached.
 */
window.CHATGPT_CONFIG = {
  appName: 'ChatGPT',
  keys: {
    groq: '',        // free: https://console.groq.com/keys
    gemini: '',      // free: https://aistudio.google.com/apikey
    openrouter: '',  // free models: https://openrouter.ai/keys
  },
  // OmniRoute on this computer, e.g. 'http://localhost:20128/v1' (only when the page is opened on that PC)
  omniroute: { url: '', key: '' },
};

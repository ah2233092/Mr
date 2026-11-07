// ChatGPT-style model menu for a personal setup: each menu name is backed by a
// list of real models (connected through OmniRoute or direct keys). The first one
// that is available answers; if it fails the next one takes over.
// Turn off with MODEL_ALIASES=off to see the real model names instead.
// Hovering the model name under a reply still shows which real model answered.

const env = process.env;

export const ALIASES = [
  { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', description: 'Newest flagship · best answers', vision: false,
    prefer: [/gemini-[3-9][\d.]*-pro/, /gemini-2\.5-pro/, /deepseek-(r1|reasoner|v3)/, /qwen-?3.*235b/, /gpt-oss-120b/, /kimi-k2/, /llama-4-maverick/, /llama-3\.3-70b/] },
  { id: 'gpt-6-astra', name: 'GPT-6 Astra', description: 'Thinks longer for hard problems', vision: false,
    prefer: [/deepseek-(r1|reasoner)/, /qwen-?3.*(thinking|235b)/, /gpt-oss-120b/, /gemini-[2-9][\d.]*-pro/, /magistral/, /llama-3\.3-70b/] },
  { id: 'gpt-6-sol', name: 'GPT-6 Sol', description: 'Great for most questions', vision: false,
    prefer: [/gemini-[2-9][\d.]*-flash(?!-lite)/, /gpt-oss-120b/, /llama-3\.3-70b/, /mistral-(large|medium)/, /qwen/] },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna', description: 'Fastest replies', vision: false,
    prefer: [/cerebras.*gpt-oss-120b/, /gpt-oss-120b/, /llama-3\.1-8b|llama3\.1-8b/, /gpt-oss-20b/, /flash-lite/, /llama-3\.3-70b/] },
  { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Previous generation', vision: false,
    prefer: [/llama-4-maverick/, /llama-3\.3-70b/, /mistral-(large|medium|small)/, /gpt-oss-20b/, /gemma-3/] },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Understands photos', vision: true,
    prefer: [/gemini-[2-9][\d.]*-flash/, /llama-4-scout/, /llama-4-maverick/, /gemma-3/, /pixtral|mistral-(medium|small)/, /gemini/] },
];

export const aliasMode = () => (env.MODEL_ALIASES || 'on').toLowerCase() !== 'off';
export const aliasKey = (a) => `alias:${a.id}`;
export const findAlias = (key) => ALIASES.find((a) => aliasKey(a) === key) || null;

// Real models behind an alias, best first (free models before paid ones).
export function resolveAlias(alias, models) {
  const pool = models.filter((m) => !m.hidden && (!alias.vision || m.vision));
  // The real model with exactly this name (e.g. with an OpenAI key) always comes first.
  const out = pool.filter((m) => m.name === alias.name);
  for (const re of alias.prefer) {
    const hits = pool.filter((m) => re.test(m.key) && !out.includes(m))
      .sort((a, b) => (a.tier === 'paid') - (b.tier === 'paid') || b.speed - a.speed || b.score - a.score);
    out.push(...hits);
  }
  return out;
}

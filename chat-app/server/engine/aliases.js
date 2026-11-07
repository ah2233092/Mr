// ChatGPT model menu for a personal setup: each menu name is backed by a
// list of real models (connected through OmniRoute or direct keys). The first one
// that is available answers; if it fails the next one takes over.
// Turn off with MODEL_ALIASES=off to see the real model names instead.
// Hovering the model name under a reply still shows which real model answered.

const env = process.env;

// Same menu as ChatGPT (Nov 2026): GPT-6 with its thinking levels, then the older
// models. Each level sends the matching reasoning effort to models that support it.
export const ALIASES = [
  { id: 'gpt-6-instant', name: 'GPT-6 Instant', short: 'Instant', group: 'GPT-6', description: 'Answers right away', effort: 'low', vision: false,
    prefer: [/gemini-[2-9][\d.]*-flash(?!-lite)/, /cerebras.*gpt-oss-120b/, /gpt-oss-120b/, /llama-3\.3-70b/, /mistral-(large|medium)/, /qwen/] },
  { id: 'gpt-6-medium', name: 'GPT-6 Medium', short: 'Medium', group: 'GPT-6', description: 'Thinks a little for better answers', effort: 'medium', vision: false,
    prefer: [/gpt-oss-120b/, /gemini-[2-9][\d.]*-flash(?!-lite)/, /qwen-?3.*235b/, /deepseek-(v3|chat)/, /llama-3\.3-70b/] },
  { id: 'gpt-6-high', name: 'GPT-6 High', short: 'High', group: 'GPT-6', description: 'Thinks longer for harder problems', effort: 'high', vision: false,
    prefer: [/gemini-[2-9][\d.]*-pro/, /deepseek-(r1|reasoner)/, /qwen-?3.*(thinking|235b)/, /gpt-oss-120b/, /kimi-k2/, /magistral/, /llama-3\.3-70b/] },
  { id: 'gpt-6-extra-high', name: 'GPT-6 Extra High', short: 'Extra High', group: 'GPT-6', description: 'Thinks the longest for the hardest problems', effort: 'high', vision: false,
    prefer: [/claude-(opus|sonnet|fable)/, /gemini-[3-9][\d.]*-pro/, /gemini-2\.5-pro/, /deepseek-(r1|reasoner)/, /qwen-?3.*(thinking|235b)/, /gpt-oss-120b/, /llama-3\.3-70b/] },
  { id: 'gpt-6-pro', name: 'GPT-6 Pro', short: 'Pro', group: 'GPT-6', description: 'Research-grade intelligence', effort: 'high', vision: false,
    prefer: [/claude-(opus|fable)/, /claude-sonnet/, /gemini-[3-9][\d.]*-pro/, /gemini-2\.5-pro/, /deepseek-(r1|reasoner)/, /qwen-?3.*235b/, /gpt-oss-120b/, /kimi-k2/, /llama-3\.3-70b/] },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', group: 'Other models', description: 'Previous flagship', effort: 'medium', vision: false,
    prefer: [/llama-4-maverick/, /llama-3\.3-70b/, /gemini-[2-9][\d.]*-flash(?!-lite)/, /mistral-(large|medium)/, /gpt-oss-120b/] },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', group: 'Other models', description: 'Balanced and dependable', effort: 'low', vision: false,
    prefer: [/mistral-(large|medium|small)/, /llama-4-scout/, /gemma-3/, /llama-3\.3-70b/, /gpt-oss-20b/] },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', group: 'Other models', description: 'Fast for everyday tasks', effort: 'low', vision: false,
    prefer: [/llama-3\.1-8b|llama3\.1-8b/, /gpt-oss-20b/, /flash-lite/, /cerebras.*gpt-oss-120b/, /llama-3\.3-70b/] },
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

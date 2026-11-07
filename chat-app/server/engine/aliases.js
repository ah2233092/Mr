// ChatGPT model menu for a personal setup: each menu name is backed by a
// list of real models (connected through OmniRoute or direct keys). The first one
// that is available answers; if it fails the next one takes over.
// Turn off with MODEL_ALIASES=off to see the real model names instead.
// Hovering the model name under a reply still shows which real model answered.

import { MENU } from './menu.js';

const env = process.env;

// Free models behind each kind of menu entry, best first (matched against "provider:model").
// A real OpenAI model with exactly the menu name (OpenAI key connected) always answers first.
export const TIERS = {
  pro: [/claude-(opus|fable)/, /claude-sonnet/, /gemini-[3-9][\d.]*-pro/, /gemini-2\.5-pro/, /deepseek-(r1|reasoner)/, /qwen-?3.*235b/, /gpt-oss-120b/, /kimi-k2/, /llama-3\.3-70b/],
  think: [/gemini-[2-9][\d.]*-pro/, /deepseek-(r1|reasoner)/, /qwen-?3.*(thinking|235b)/, /gpt-oss-120b/, /kimi-k2/, /magistral/, /llama-3\.3-70b/],
  smart: [/gemini-[2-9][\d.]*-flash(?!-lite)/, /cerebras.*gpt-oss-120b/, /gpt-oss-120b/, /llama-3\.3-70b/, /mistral-(large|medium)/, /qwen/],
  balanced: [/llama-4-maverick/, /llama-3\.3-70b/, /mistral-(large|medium)/, /gemini-[2-9][\d.]*-flash(?!-lite)/, /gpt-oss-120b/],
  fast: [/llama-3\.1-8b|llama3\.1-8b/, /gpt-oss-20b/, /flash-lite/, /cerebras.*gpt-oss-120b/, /llama-3\.3-70b/],
  vision: [/gemini-[2-9][\d.]*-flash/, /llama-4-scout/, /llama-4-maverick/, /gemma-3/, /pixtral|mistral-(medium|small)/, /gemini/],
  code: [/qwen.*coder/, /codestral|devstral/, /gpt-oss-120b/, /deepseek/, /kimi-k2/, /llama-3\.3-70b/],
};

export const ALIASES = MENU.map((e) => ({ ...e, vision: false, prefer: TIERS[e.tier] || TIERS.smart }));

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

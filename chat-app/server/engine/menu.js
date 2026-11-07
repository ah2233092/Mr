// The model menu: every ChatGPT model, A to Z, the way ChatGPT names them.
// Used by the server (engine/aliases.js) and by the single-file website (build-static.mjs
// puts it into index.html). Each name is answered by free models of its `tier`
// (see TIERS in aliases.js and static/backend.js); hovering a reply shows the real one.
//   tier:   pro | think | smart | balanced | fast | vision | code
//   effort: thinking level sent to models that take it (low | medium | high)

const m = (id, name, group, description, tier, effort, short) => ({ id, name, group, description, tier, effort, ...(short ? { short } : {}) });

export const MENU = [
  // What ChatGPT shows first: GPT-6 and its thinking levels.
  m('gpt-6-instant', 'GPT-6 Instant', 'GPT-6', 'Answers right away', 'smart', 'low', 'Instant'),
  m('gpt-6-medium', 'GPT-6 Medium', 'GPT-6', 'Thinks a little for better answers', 'smart', 'medium', 'Medium'),
  m('gpt-6-high', 'GPT-6 High', 'GPT-6', 'Thinks longer for harder problems', 'think', 'high', 'High'),
  m('gpt-6-extra-high', 'GPT-6 Extra High', 'GPT-6', 'Thinks the longest for the hardest problems', 'pro', 'high', 'Extra High'),
  m('gpt-6-pro', 'GPT-6 Pro', 'GPT-6', 'Research-grade intelligence', 'pro', 'high', 'Pro'),

  m('gpt-6-astra', 'GPT-6 Astra', 'GPT-6', 'Most capable for hard reasoning', 'pro', 'high'),
  m('gpt-6-sol', 'GPT-6 Sol', 'GPT-6', 'Great for most tasks', 'smart', 'medium'),
  m('gpt-6-luna', 'GPT-6 Luna', 'GPT-6', 'Fast and light', 'fast', 'low'),

  m('gpt-6.1-sol', 'GPT-6.1 Sol', 'GPT-6.1', 'Newest flagship', 'pro', 'medium'),
  m('gpt-6.1-terra', 'GPT-6.1 Terra', 'GPT-6.1', 'Newest, balanced and fast', 'smart', 'medium'),

  m('gpt-5.6-sol', 'GPT-5.6 Sol', 'GPT-5.6', 'Previous flagship', 'balanced', 'medium'),
  m('gpt-5.6-terra', 'GPT-5.6 Terra', 'GPT-5.6', 'Balanced and dependable', 'balanced', 'low'),
  m('gpt-5.6-luna', 'GPT-5.6 Luna', 'GPT-5.6', 'Fast for everyday tasks', 'fast', 'low'),

  m('gpt-5.5-instant', 'GPT-5.5 Instant', 'GPT-5.5', 'Answers right away', 'smart', 'low'),
  m('gpt-5.5-thinking', 'GPT-5.5 Thinking', 'GPT-5.5', 'Thinks longer for better answers', 'think', 'high'),
  m('gpt-5.5-pro', 'GPT-5.5 Pro', 'GPT-5.5', 'Research-grade intelligence', 'pro', 'high'),

  m('gpt-5.4-thinking', 'GPT-5.4 Thinking', 'GPT-5.4', 'Thinks longer for better answers', 'think', 'high'),
  m('gpt-5.4-pro', 'GPT-5.4 Pro', 'GPT-5.4', 'Research-grade intelligence', 'pro', 'high'),

  m('gpt-5.3-instant', 'GPT-5.3 Instant', 'GPT-5.3', 'Fast everyday answers', 'smart', 'low'),
  m('gpt-5.3-codex', 'GPT-5.3 Codex', 'GPT-5.3', 'Best for coding', 'code', 'medium'),

  m('gpt-5.2-instant', 'GPT-5.2 Instant', 'GPT-5.2', 'Answers right away', 'balanced', 'low'),
  m('gpt-5.2-thinking', 'GPT-5.2 Thinking', 'GPT-5.2', 'Thinks longer for better answers', 'think', 'high'),
  m('gpt-5.2-pro', 'GPT-5.2 Pro', 'GPT-5.2', 'Research-grade intelligence', 'pro', 'high'),

  m('gpt-5.1-instant', 'GPT-5.1 Instant', 'GPT-5.1', 'Warm and conversational', 'balanced', 'low'),
  m('gpt-5.1-thinking', 'GPT-5.1 Thinking', 'GPT-5.1', 'Thinks longer for better answers', 'think', 'high'),

  m('gpt-5-instant', 'GPT-5 Instant', 'GPT-5', 'Answers right away', 'balanced', 'low'),
  m('gpt-5-thinking', 'GPT-5 Thinking', 'GPT-5', 'Thinks longer for better answers', 'think', 'high'),
  m('gpt-5-pro', 'GPT-5 Pro', 'GPT-5', 'Research-grade intelligence', 'pro', 'high'),
  m('gpt-5-mini', 'GPT-5 mini', 'GPT-5', 'Faster for everyday tasks', 'fast', 'low'),

  m('o3-pro', 'o3-pro', 'o-series', 'Legacy reasoning expert', 'pro', 'high'),
  m('o3', 'o3', 'o-series', 'Uses advanced reasoning', 'think', 'high'),
  m('o4-mini-high', 'o4-mini-high', 'o-series', 'Great at coding and visual reasoning', 'think', 'high'),
  m('o4-mini', 'o4-mini', 'o-series', 'Fastest at advanced reasoning', 'think', 'medium'),
  m('o3-mini', 'o3-mini', 'o-series', 'Fast at advanced reasoning', 'think', 'medium'),
  m('o1-pro', 'o1-pro', 'o-series', 'Uses advanced reasoning', 'pro', 'high'),
  m('o1', 'o1', 'o-series', 'Uses advanced reasoning', 'think', 'high'),
  m('o1-mini', 'o1-mini', 'o-series', 'Faster at reasoning', 'think', 'low'),

  m('gpt-4.5', 'GPT-4.5', 'GPT-4', 'Good for writing and exploring ideas', 'balanced', 'low'),
  m('gpt-4.1', 'GPT-4.1', 'GPT-4', 'Great for quick coding and analysis', 'code', 'low'),
  m('gpt-4.1-mini', 'GPT-4.1 mini', 'GPT-4', 'Faster for everyday tasks', 'fast', 'low'),
  m('gpt-4o', 'GPT-4o', 'GPT-4', 'Great for most tasks', 'vision', 'low'),
  m('gpt-4o-mini', 'GPT-4o mini', 'GPT-4', 'Faster for everyday tasks', 'fast', 'low'),
  m('gpt-4', 'GPT-4', 'GPT-4', 'Legacy model', 'balanced', 'low'),
  m('gpt-3.5', 'GPT-3.5', 'GPT-3.5', 'The original ChatGPT model', 'fast', 'low'),
];

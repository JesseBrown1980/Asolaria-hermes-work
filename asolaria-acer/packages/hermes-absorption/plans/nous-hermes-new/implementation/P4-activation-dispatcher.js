// P4-activation-dispatcher.js — wires dispatch.js + UCB1 + embedding-similarity
// Replaces the heuristic selectGlyphsForQuery with a real selection:
//   query → embedding → cosine top-K candidate arms → UCB1 pick → arm.behavior_fn(query)
// Reward feedback updates arm n_i + sum_reward for next-pull selection.
//
// LIVE-WIRE STATUS: NOT YET WIRED to hookwall. P4 stays staged until operator env-flip.
// Path: pure JS dispatcher + reward callback. Hookwall wiring deferred to P5 (post-cosign).
//
// Authority: OP-JESSE 2026-05-07 push Hermes P3→P4
// Cosign anchor: seq=50

'use strict';

const path = require('path');
const { ARMS, freshArmState, getArm } = require('./P4-arm-registry');
const { dispatch: P2_dispatch } = require('./dispatch');

// Resolve UCB1 + embedding from sibling asolaria-behcs-256 src dirs
const UCB1_DIR = 'C:/asolaria-behcs-256/src/ucb1';
const EMBED_DIR = 'C:/asolaria-behcs-256/src/embedding';

let ucb1, embedQuery;
try {
  ucb1 = require(path.join(UCB1_DIR, 'selection.js'));
} catch (e) {
  ucb1 = null;
  console.warn('[P4] ucb1 not loaded:', e.message);
}
try {
  embedQuery = require(path.join(EMBED_DIR, 'query-api.js'));
} catch (e) {
  embedQuery = null;
  // optional — fallback to deterministic arm-id hashing
}

// ─── Embedding stub (FW-04 placeholder until real MiniLM hooked) ──
// query → cheap deterministic vector of dim=16 by char-bigram hash.
// Returns { vec: number[16], norm: number }
function cheapEmbed(text) {
  const t = String(text || '').toLowerCase();
  const vec = new Array(16).fill(0);
  for (let i = 0; i < t.length - 1; i++) {
    const h = (t.charCodeAt(i) * 31 + t.charCodeAt(i + 1)) % 16;
    vec[h] += 1;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  return { vec, norm: norm || 1 };
}

// ─── Static arm-vectors (cosine candidates) ───────────────────────
// Each arm gets a hand-anchored "topic vector" via a representative phrase.
const ARM_ANCHOR_PHRASES = {
  summarize:    'tldr summary brief shorten compress',
  explain:      'explain why how step concept introduce',
  'reason-step': 'reason think step prove derive logic',
  'reason-revise': 'wrong correct revise but actually mistake',
  derive:       'prove derive theorem given conclude',
  classify:     'classify category bucket label tag',
  extract:      'extract pull find structured fields parse',
  translate:    'translate convert map transform language',
  compare:      'compare contrast versus difference between',
  plan:         'plan steps roadmap goal decompose tasks',
  'emit-normal': 'echo say generate write produce normal',
  refuse:       'cannot wont policy harmful unsafe decline',
};

const ARM_VECS = (() => {
  const out = {};
  for (const a of ARMS) {
    out[a.arm_id] = cheapEmbed(ARM_ANCHOR_PHRASES[a.arm_id] || a.description);
  }
  return out;
})();

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.vec.length; i++) dot += a.vec[i] * b.vec[i];
  return dot / (a.norm * b.norm);
}

// ─── Cosine top-K candidate selection ────────────────────────────
function topKByCosine(query, K) {
  const qe = cheapEmbed(query);
  const scored = ARMS.map(a => ({
    arm_id: a.arm_id,
    cosine_score: cosine(qe, ARM_VECS[a.arm_id]),
    glyph_cp: a.glyph_cp,
  }));
  scored.sort((x, y) => y.cosine_score - x.cosine_score);
  return scored.slice(0, K);
}

// ─── UCB1 pick over top-K candidates ─────────────────────────────
function ucb1Pick(topK, armState, t) {
  // Map topK arm_ids → matching armState entries (so n_i, sum_reward join through)
  const candidates = topK.map(c => {
    const s = armState.find(a => a.arm_id === c.arm_id);
    return s || { arm_id: c.arm_id, n_i: 0, sum_reward: 0 };
  });
  if (ucb1 && ucb1.argmax) {
    const r = ucb1.argmax(candidates, t, 2);
    return r ? r.arm : candidates[0];
  }
  // Fallback: pure cosine winner
  return candidates[0];
}

// ─── Single dispatch call ─────────────────────────────────────────
function activateDispatch(query, opts) {
  opts = opts || {};
  const armState = opts.armState || freshArmState();
  const t = opts.t || armState.reduce((s, a) => s + (a.n_i || 0), 0) + 1;
  const K = opts.K || 5;

  const t0 = Date.now();

  // 1. Cosine top-K
  const topK = topKByCosine(query, K);

  // 2. UCB1 pick
  const picked = ucb1Pick(topK, armState, t);

  // 3. Resolve to arm + invoke behavior_fn
  const arm = getArm(picked.arm_id);
  if (!arm) return { error: 'arm not found: ' + picked.arm_id };
  const behavior = arm.behavior_fn(query, opts.context || {});

  // 4. Compose response (Hermes-shaped placeholder)
  const response = {
    prefix: 'nous-hermes-4-70b-',
    selected_arm: arm.arm_id,
    arm_glyph_cp: arm.glyph_cp,
    arm_slot: arm.slot,
    cosine_topK: topK.map(c => ({ arm: c.arm_id, score: +c.cosine_score.toFixed(4) })),
    ucb1_winner: picked.arm_id,
    n_i_at_pick: armState.find(a => a.arm_id === picked.arm_id)?.n_i ?? 0,
    behavior,
    p2_route_legacy: P2_dispatch ? null : null, // present for future merge
    t,
    elapsed_ms: Date.now() - t0,
  };

  return { response, armState };
}

// ─── Reward feedback — caller observes outcome and reports r in [0,1] ──
function observeReward(armState, arm_id, r) {
  const s = armState.find(a => a.arm_id === arm_id);
  if (!s) return false;
  s.n_i = (s.n_i || 0) + 1;
  s.sum_reward = (s.sum_reward || 0) + r;
  return true;
}

module.exports = { activateDispatch, observeReward, freshArmState, ARMS, cheapEmbed, cosine };

// routes.mjs — downstream routing functions per slot.downstream_route
// Routes:
//   multi-cli-invoke           -> python multi-cli-invoke.py invoke <role> <model> <prompt>
//   omniscrcpy-antigravity-proxy -> python omniscrcpy-antigravity-proxy.py <verb> [arg]
//   google-api-client          -> STUB (HTTP wrapper signature only, marked TODO)
//   citizen-stub-queue         -> write envelope to broadcasts/<vantage>-inbox/<envelope-id>.json
//   bus-direct                 -> POST to bus :4947 with daemon-targeted verb
//   reserved                   -> reject with EVT-FEDENV-REJECTED-RESERVED-SLOT
//   meta-supervisor-slot       -> queued (live or queued if not minted)

import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const REPO_ROOT = 'C:/asolaria-acer';
const BROADCASTS_DIR = path.join(REPO_ROOT, 'broadcasts');
const MULTI_CLI_SCRIPT = path.join(REPO_ROOT, 'federation-remake-1024', 'tools', 'multi-cli-invoke', 'multi-cli-invoke.py');
const ANTIGRAVITY_SCRIPT = path.join(REPO_ROOT, 'federation-remake-1024', 'tools', 'omniscrcpy', 'omniscrcpy-antigravity-proxy.py');
const BUS_HOST = '127.0.0.1';
const BUS_PORT = 4947;
const SPAWN_TIMEOUT_MS = 60_000;

/** Helper: spawn child process, capture stdout/stderr, enforce timeout. */
function spawnCapture(cmd, args, { input = null, timeoutMs = SPAWN_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch {}
    }, timeoutMs);
    child.stdout.on('data', d => { stdout += d.toString('utf8'); });
    child.stderr.on('data', d => { stderr += d.toString('utf8'); });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, exit: -1, stdout, stderr, error: String(err), killed });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !killed, exit: code ?? -1, stdout, stderr, killed });
    });
    if (input != null) {
      try { child.stdin.write(input); child.stdin.end(); } catch {}
    } else {
      try { child.stdin.end(); } catch {}
    }
  });
}

/** Parse `cli:<role>:<model>` target. */
function parseCli(target) {
  const parts = target.split(':');
  // ["cli", role, model] — model may include further colons (rejoin)
  if (parts.length < 3 || parts[0] !== 'cli') return null;
  const role = parts[1];
  const model = parts.slice(2).join(':');
  return { role, model };
}

/** route: multi-cli-invoke */
export async function routeMultiCli(env, slot) {
  const parsed = parseCli(env.target);
  if (!parsed) {
    return { ok: false, error: 'EVT-FEDENV-REJECTED-UNRESOLVABLE-TARGET', detail: `bad cli target: ${env.target}` };
  }
  // python multi-cli-invoke.py invoke <role> <model> <prompt>
  return spawnCapture('python', [MULTI_CLI_SCRIPT, 'invoke', parsed.role, parsed.model, String(env.payload)]);
}

/** route: omniscrcpy-antigravity-proxy */
export async function routeAntigravity(env, slot) {
  // target form: antigravity:<model>; verb (env.verb) determines the proxy subcommand
  const model = env.target.split(':').slice(1).join(':');
  const proxyVerb = env.verb || 'send-prompt';
  const args = [ANTIGRAVITY_SCRIPT, proxyVerb];
  if (model) args.push(model);
  return spawnCapture('python', args, { input: String(env.payload) });
}

/** route: google-api-client — STUB ONLY. TODO: implement OAuth-aware HTTP wrapper. */
export async function routeGoogle(env, slot) {
  // TODO(omnidispatcher-2026-05-22): implement google-api-client wrapper
  //   - Per-surface auth (OAuth-scoped per slot.name e.g. bigquery / cloud_storage)
  //   - HTTP fetch via node:https
  //   - Token refresh via gcloud auth print-access-token (cached 50min)
  //   - Quota / rate-limit headers
  //   - Return BEHCS-1024 glyph-encoded response body
  return {
    ok: false,
    exit: 0,
    stdout: '',
    stderr: '',
    stub: true,
    surface: slot?.name ?? env.target,
    note: 'google-api-client STUB — not implemented in skeleton dispatcher',
  };
}

/** route: citizen-stub-queue — write envelope to broadcasts/<vantage>-inbox/<envelope-id>.json */
export async function routeCitizenStub(env, slot) {
  // target: citizen:<vantage>  e.g. citizen:liris
  const vantage = env.target.split(':')[1] || (slot?.name ?? 'unknown');
  const inboxDir = path.join(BROADCASTS_DIR, `${vantage}-inbox`);
  await mkdir(inboxDir, { recursive: true });
  const envId = `${env.row_hash}-${Date.now()}`;
  const fp = path.join(inboxDir, `${envId}.json`);
  await writeFile(fp, JSON.stringify({ ...env, _queued_at: new Date().toISOString(), _slot_id: slot?.slot_id }, null, 2), 'utf8');
  return { ok: true, exit: 0, stdout: fp, stderr: '', queued_path: fp, vantage };
}

/** route: bus-direct — POST to bus :4947 with daemon-targeted verb */
export async function routeBusDirect(env, slot) {
  // target form: daemon:<entity>  -> verb tag = daemon-<entity>:<env.verb>
  const entity = env.target.split(':')[1] || (slot?.name ?? 'unknown');
  const body = JSON.stringify({
    verb_tag: `daemon-${entity}:${env.verb}`,
    payload: env.payload,
    envelope_row_hash: env.row_hash,
    caller_pid: env.caller_pid,
    back_address: env.back_address,
  });
  return new Promise((resolve) => {
    const req = httpRequest({
      host: BUS_HOST,
      port: BUS_PORT,
      method: 'POST',
      path: '/v1/emit',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      timeout: 5_000,
    }, (res) => {
      let resp = '';
      res.on('data', c => { resp += c.toString('utf8'); });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, exit: 0, stdout: resp, stderr: '', http_status: res.statusCode }));
    });
    req.on('error', (err) => resolve({ ok: false, exit: -1, stdout: '', stderr: String(err), error: String(err) }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, exit: -1, stdout: '', stderr: 'bus timeout', timeout: true }); });
    req.write(body);
    req.end();
  });
}

/** route: meta-supervisor-slot — queue for live meta (skeleton: enqueue stub) */
export async function routeMetaSupervisor(env, slot) {
  const inboxDir = path.join(BROADCASTS_DIR, 'meta-inbox');
  await mkdir(inboxDir, { recursive: true });
  const fp = path.join(inboxDir, `${(slot?.name ?? 'meta')}-${env.row_hash}.json`);
  await writeFile(fp, JSON.stringify({ ...env, _queued_at: new Date().toISOString(), _meta: slot?.name }, null, 2), 'utf8');
  return { ok: true, exit: 0, stdout: fp, stderr: '', queued_path: fp, meta: slot?.name };
}

/** route: reserved — explicit reject */
export async function routeReserved(env, slot) {
  return {
    ok: false,
    exit: 0,
    stdout: '',
    stderr: '',
    reason: 'EVT-FEDENV-REJECTED-RESERVED-SLOT',
    detail: `slot ${slot?.slot_id} is reserved for fractal sub-spawn — instantiate-child before invoke`,
  };
}

/** route: local-lmstudio — POST to LM Studio :1234 OpenAI-compat endpoint (Gemma already loaded). */
export async function routeLmStudio(env, slot) {
  // target form: local:lmstudio:<model>  (e.g. local:lmstudio:google/gemma-4-e4b)
  const model = env.target.split(':').slice(2).join(':') || 'google/gemma-4-e4b';
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: 'You are a federation worker bound by Jesse-apex constitutional canon.' },
      { role: 'user', content: String(env.payload) },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  });
  return new Promise((resolve) => {
    const req = httpRequest({
      host: '127.0.0.1', port: 1234, method: 'POST',
      path: '/v1/chat/completions',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      timeout: 60_000,
    }, (res) => {
      let resp = '';
      res.on('data', c => { resp += c.toString('utf8'); });
      res.on('end', () => resolve({ ok: res.statusCode === 200, exit: 0, stdout: resp, stderr: '', http_status: res.statusCode, model }));
    });
    req.on('error', (err) => resolve({ ok: false, exit: -1, stdout: '', stderr: String(err), error: String(err) }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, exit: -1, stdout: '', stderr: 'lmstudio timeout', timeout: true }); });
    req.write(body);
    req.end();
  });
}

/** Dispatch table by downstream_route string from slot. */
export const ROUTE_TABLE = {
  'multi-cli-invoke': routeMultiCli,
  'omniscrcpy-antigravity-proxy': routeAntigravity,
  'google-api-client': routeGoogle,
  'citizen-stub-queue': routeCitizenStub,
  'bus-direct': routeBusDirect,
  'meta-supervisor-slot': routeMetaSupervisor,
  'reserved': routeReserved,
  'local-lmstudio': routeLmStudio,
};

/** Resolve a slot's route function. Returns null if no resolver registered. */
export function resolveRoute(slot) {
  if (!slot) return null;
  return ROUTE_TABLE[slot.downstream_route] || null;
}

/** Build a FEDENV-v1-shaped response envelope wrapping a downstream result. */
export function buildResponseEnvelope(originalEnv, result, slot) {
  const ts = new Date().toISOString();
  const payload = JSON.stringify({
    result_ok: result.ok ?? false,
    exit_code: result.exit ?? -1,
    stdout: (result.stdout ?? '').slice(0, 8_000),
    stderr: (result.stderr ?? '').slice(0, 2_000),
    extra: { ...result, stdout: undefined, stderr: undefined },
  });
  const row = createHash('sha256').update(`FEDENV|${slot?.pid ?? 'omnidispatcher'}respond${payload}${ts}`).digest('hex').slice(0, 16);
  return {
    caller_pid: slot?.pid ?? `AGT-OMNIDISPATCHER-RESPONDER-W2026-P00`,
    target: `pid:${originalEnv.caller_pid?.split('-H')[1]?.slice(0, 5) ?? 'H0000'}`,
    verb: 'respond',
    payload,
    back_address: originalEnv.back_address,
    cube_47d: slot?.cube_47d ?? '0-0-0-0-0-0',
    glyph_5: slot?.glyph_5 ?? '?????',
    cosign_token: originalEnv.cosign_token,
    ttl_seconds: 300,
    antecedents: originalEnv.row_hash,
    row_hash: row,
    ts,
    in_reply_to: originalEnv.row_hash,
  };
}

export default { ROUTE_TABLE, resolveRoute, buildResponseEnvelope };

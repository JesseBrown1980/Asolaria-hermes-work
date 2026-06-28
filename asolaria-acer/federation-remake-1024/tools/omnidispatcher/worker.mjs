// worker.mjs — worker_threads handler
// Picks envelopes off the parent's dispatch queue (via parentPort messages) and
// routes them per slot.downstream_route. Returns response envelope to parent.

import { parentPort, workerData } from 'node:worker_threads';
import { resolveRoute, buildResponseEnvelope } from './routes.mjs';

if (!parentPort) {
  throw new Error('worker.mjs must be spawned via node:worker_threads with a parentPort');
}

const WORKER_ID = workerData?.workerId ?? -1;
const WORKER_TIMEOUT_MS = 60_000;

parentPort.on('message', async (msg) => {
  if (!msg || msg.type !== 'dispatch') return;
  const { envelope, slot, jobId } = msg;
  const started = Date.now();
  let result;
  try {
    const fn = resolveRoute(slot);
    if (!fn) {
      result = {
        ok: false,
        exit: -1,
        stdout: '',
        stderr: '',
        reason: 'EVT-FEDENV-REJECTED-UNRESOLVABLE-TARGET',
        detail: `no resolver for downstream_route=${slot?.downstream_route}`,
      };
    } else {
      // Per-job timeout guard
      result = await Promise.race([
        fn(envelope, slot),
        new Promise((_, rej) => setTimeout(() => rej(new Error('worker-timeout')), WORKER_TIMEOUT_MS)),
      ]).catch(err => ({
        ok: false,
        exit: -1,
        stdout: '',
        stderr: String(err?.stack ?? err),
        error: String(err?.message ?? err),
      }));
    }
  } catch (err) {
    result = {
      ok: false,
      exit: -1,
      stdout: '',
      stderr: String(err?.stack ?? err),
      error: String(err?.message ?? err),
    };
  }
  const elapsedMs = Date.now() - started;
  const response = buildResponseEnvelope(envelope, result, slot);
  parentPort.postMessage({
    type: 'result',
    jobId,
    workerId: WORKER_ID,
    elapsedMs,
    response,
    rawResult: { ok: result.ok, exit: result.exit, stub: result.stub === true },
  });
});

parentPort.postMessage({ type: 'ready', workerId: WORKER_ID });

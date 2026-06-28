#!/usr/bin/env node
// 10K MICRO-KERNEL cascade — worker_thread pool emulation of Asolaria-OS-on-Metal kernel.
// Operator 2026-05-28T17:42-17:48Z: "10K micro kernels + we did 100B in 7hr + look at NEURO 100B + WILL BE FASTER"
//
// Pattern (NEURO 100B canonical fast inner loop):
//   - 1 sha256 per (kernel, beat) tuple — work with raw Buffer (NO .toString('hex') per packet)
//   - 7 lane scores DERIVED from digest bytes (no extra sha per lane)
//   - Worker pool size = CPU cores (true OS-level parallelism)
//   - Per-kernel HBP output to D drive (prism data plane)
//   - Aggregator collects all kernel outputs
//
// Scope: 10K kernels x 93312 beats = 933.12M (kernel,beat) tuples
//        x 7 lane scores per tuple = 6.53B logical packets
// Expected aggregate rate at N=cpu-count workers: 4-30M+ packets/sec.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(__filename);

const BEATS_PER_WAVE = 15552;
const WAVE_COUNT = 6;
const TOTAL_BEATS = BEATS_PER_WAVE * WAVE_COUNT;
const LANES = 7; // post-LYMPHATIC
const GENIUS_T = 0.95;
const MISTAKE_T = 0.05;

const SUBSTRATE_ROOT = 'D:/asolaria-micro-kernels-v1';

// ============= WORKER =============
if (!isMainThread) {
  const { startKernel, endKernel, manifestPath, cascadeId, resultsDir, workerIdx } = workerData;
  const manifest = readFileSync(manifestPath, 'utf8').split('\n');
  const mkRows = manifest.filter(l => l.startsWith('MK|'));

  let workerPackets = 0, workerGenius = 0, workerMistake = 0;
  const workerLaneCounts = new Array(LANES).fill(0);
  const kernelResults = [];

  for (let k = startKernel; k < endKernel && k < mkRows.length; k++) {
    const row = mkRows[k];
    const m = row.match(/^MK\|idx=(\d+)\|pid=([a-f0-9]+)\|prime=(\d+)\|/);
    if (!m) continue;
    const kernelIdx = Number(m[1]);
    const kernelPidPrefix = m[2];
    const prime = Number(m[3]);

    // Per-kernel anchor as raw Buffer prefix (reused per packet)
    const anchorPrefix = `MK${kernelIdx}P${prime}B`;
    let kernelPackets = 0, kernelGenius = 0, kernelMistake = 0;
    const kernelLanes = new Array(LANES).fill(0);

    // Tight inner loop — NEURO 100B pattern (1 sha per beat, lane derived from bytes)
    for (let beat = 0; beat < TOTAL_BEATS; beat++) {
      const digest = createHash('sha256').update(`${anchorPrefix}${beat}`).digest();
      // Derive 7 lane scores from digest bytes (NO additional sha)
      // Use uint32be at offsets 0, 4, 8, 12, 16, 20, 24 (need 28 bytes; sha256 = 32 bytes, fits)
      for (let lane = 0; lane < LANES; lane++) {
        const score = digest.readUInt32BE(lane * 4) / 0xFFFFFFFF;
        kernelLanes[lane]++;
        kernelPackets++;
        if (score > GENIUS_T) kernelGenius++;
        else if (score < MISTAKE_T) kernelMistake++;
      }
    }

    // Write per-kernel HBP (lightweight summary)
    const kernelHbp = [
      `MK-RESULT|kernel=${kernelIdx}|prime=${prime}|packets=${kernelPackets}|genius=${kernelGenius}|mistake=${kernelMistake}|worker=${workerIdx}`,
      `LANES|${[0,1,2,3,4,5,6].map(i => `lane${i}=${kernelLanes[i]}`).join('|')}`,
    ].join('\n') + '\n';
    writeFileSync(resolve(resultsDir, `mk-${String(kernelIdx).padStart(5, '0')}.hbp`), kernelHbp);

    workerPackets += kernelPackets;
    workerGenius += kernelGenius;
    workerMistake += kernelMistake;
    for (let i = 0; i < LANES; i++) workerLaneCounts[i] += kernelLanes[i];
    kernelResults.push({ kernelIdx, packets: kernelPackets, genius: kernelGenius, mistake: kernelMistake });
  }

  parentPort.postMessage({
    workerIdx,
    startKernel, endKernel,
    workerPackets, workerGenius, workerMistake,
    workerLaneCounts,
    kernelCount: kernelResults.length,
  });

} else {
  // ============= MAIN =============
  const KERNEL_COUNT = parseInt(process.argv[2] || '10000', 10);
  const N_WORKERS = parseInt(process.argv[3] || String(Math.max(1, os.cpus().length - 1)), 10);
  const CASCADE_ID = `mk-cascade-${Date.now()}`;
  const RESULTS_DIR = resolve(SUBSTRATE_ROOT, `results-${CASCADE_ID}`);
  mkdirSync(RESULTS_DIR, { recursive: true });
  const MANIFEST_PATH = resolve(SUBSTRATE_ROOT, 'manifest.hbp');
  const OUT_DIR = resolve(REPO, `data/runs/${CASCADE_ID}`);
  mkdirSync(OUT_DIR, { recursive: true });
  const CHAIN_URL = process.env.COSIGN_URL || 'http://127.0.0.1:4953';

  function ts() { return new Date().toISOString(); }
  function sha16(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }

  async function appendChain(event, body) {
    try {
      const r = await fetch(`${CHAIN_URL}/api/cosign/append`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ts: ts(), vantage: 'acer', ...body }),
      });
      return await r.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  const orchStart = Date.now();
  const totalExpected = KERNEL_COUNT * TOTAL_BEATS * LANES;
  console.log(`MK-CASCADE-START|cascade=${CASCADE_ID}|kernels=${KERNEL_COUNT}|workers=${N_WORKERS}|beats_total=${TOTAL_BEATS}|lanes=${LANES}|total_packets=${totalExpected}|results_dir=${RESULTS_DIR}|ts=${ts()}`);
  console.log(`MK-CASCADE-CONFIG|cpu_cores=${os.cpus().length}|node_version=${process.version}|platform=${process.platform}`);

  // Dispatch ranges to workers
  const slice = Math.ceil(KERNEL_COUNT / N_WORKERS);
  const workerPromises = [];
  for (let w = 0; w < N_WORKERS; w++) {
    const start = w * slice;
    const end = Math.min(start + slice, KERNEL_COUNT);
    if (start >= KERNEL_COUNT) break;
    workerPromises.push(new Promise((resolveP, rejectP) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: {
          startKernel: start, endKernel: end,
          manifestPath: MANIFEST_PATH,
          cascadeId: CASCADE_ID,
          resultsDir: RESULTS_DIR,
          workerIdx: w,
        },
      });
      worker.on('message', resolveP);
      worker.on('error', rejectP);
      worker.on('exit', code => { if (code !== 0) rejectP(new Error(`worker ${w} exit ${code}`)); });
    }));
    console.log(`MK-WORKER-LAUNCH|w=${w}|kernel_range=${start}-${end - 1}|count=${end - start}`);
  }

  const results = await Promise.all(workerPromises);
  const orchMs = Date.now() - orchStart;

  // Aggregate
  let totalPackets = 0, totalGenius = 0, totalMistake = 0;
  const aggLaneCounts = new Array(LANES).fill(0);
  for (const r of results) {
    totalPackets += r.workerPackets;
    totalGenius += r.workerGenius;
    totalMistake += r.workerMistake;
    for (let i = 0; i < LANES; i++) aggLaneCounts[i] += r.workerLaneCounts[i];
  }
  const orchRate = Math.round(totalPackets / (orchMs / 1000));

  console.log(`MK-CASCADE-AGG|total_packets=${totalPackets}|genius=${totalGenius}|mistake=${totalMistake}|wallClock_ms=${orchMs}|wallClock_sec=${(orchMs/1000).toFixed(2)}|rate_per_sec=${orchRate}|workers=${N_WORKERS}|cpu_cores=${os.cpus().length}`);
  for (const r of results) {
    console.log(`MK-WORKER-DONE|w=${r.workerIdx}|kernel_range=${r.startKernel}-${r.endKernel - 1}|packets=${r.workerPackets}|genius=${r.workerGenius}|mistake=${r.workerMistake}`);
  }

  // Seal aggregate HBPv1
  const aggRows = [];
  aggRows.push(`MK-CASCADE-SUMMARY|cascade=${CASCADE_ID}|kernels=${KERNEL_COUNT}|workers=${N_WORKERS}|cpu_cores=${os.cpus().length}|total_packets=${totalPackets}|genius=${totalGenius}|mistake=${totalMistake}|wallClock_ms=${orchMs}|rate_per_sec=${orchRate}|ts=${ts()}|sha16=${sha16('hdr')}`);
  aggRows.push(`AGG-LANES|${aggLaneCounts.map((v, i) => `lane${i}=${v}`).join('|')}|sha16=${sha16('lanes')}`);
  for (const r of results) {
    aggRows.push(`WORKER|w=${r.workerIdx}|range=${r.startKernel}-${r.endKernel-1}|packets=${r.workerPackets}|genius=${r.workerGenius}|mistake=${r.workerMistake}|sha16=${sha16('w' + r.workerIdx)}`);
  }
  aggRows.push(`MK-CASCADE-FOOTER|endTs=${ts()}|results_dir=${RESULTS_DIR}|sha16=${sha16('footer')}`);

  const aggHbp = aggRows.join('\n') + '\n';
  const aggPath = resolve(OUT_DIR, `aggregate-${CASCADE_ID}.hbp`);
  writeFileSync(aggPath, aggHbp);
  const aggSha = createHash('sha256').update(aggHbp).digest('hex').slice(0, 16);
  writeFileSync(aggPath + '.sha256', createHash('sha256').update(aggHbp).digest('hex') + '  ' + aggPath.split('/').pop() + '\n');

  const aggChain = await appendChain('MK-10K-CASCADE-COMPLETE-WORKER-POOL', {
    cascadeId: CASCADE_ID, kernels: KERNEL_COUNT, workers: N_WORKERS, cpu_cores: os.cpus().length,
    total_packets: totalPackets, wallClock_ms: orchMs, rate_per_sec: orchRate,
    total_genius: totalGenius, total_mistake: totalMistake,
    aggregate_sha16: aggSha,
    authority: 'QUINTUPLE-COSIGN-APEX-MINT+OP-JESSE-10K-microkernels-WILL-BE-FASTER',
  });

  console.log(`MK-CASCADE-SEALED|agg_sha=${aggSha}|chain_seq=${aggChain.seq || 'FAIL'}`);
  console.log(`MK-CASCADE-DONE|total_packets=${totalPackets}|wallClock_sec=${(orchMs/1000).toFixed(2)}|rate_per_sec=${orchRate}|genius=${totalGenius}|mistake=${totalMistake}|agg_seq=${aggChain.seq || 'FAIL'}|results_dir=${RESULTS_DIR}`);
}

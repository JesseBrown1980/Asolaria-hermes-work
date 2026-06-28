// port-pool.mjs — lazy port allocator for per-slot API ports
// Range :4951..:5950 (1000 ports). Allocate on first slot API call; release after 300s idle.
// No external deps. Pure in-memory bookkeeping; callers do actual HTTP bind.

const POOL_START = 4951;
const POOL_END = 5950; // inclusive — 1000 ports
const DEFAULT_IDLE_MS = 300_000;

export class PortPool {
  constructor({ start = POOL_START, end = POOL_END, idleMs = DEFAULT_IDLE_MS } = {}) {
    this.start = start;
    this.end = end;
    this.idleMs = idleMs;
    // slot_id -> { port, lastActive }
    this.bySlot = new Map();
    // port -> slot_id
    this.byPort = new Map();
    // free-list (LIFO) of released ports for reuse
    this.freeList = [];
    this.nextFresh = start;
  }

  /** Allocate (or return existing) port for slotId. Returns port number or null on exhaustion. */
  allocate(slotId) {
    const existing = this.bySlot.get(slotId);
    if (existing) {
      existing.lastActive = Date.now();
      return existing.port;
    }
    let port;
    if (this.freeList.length > 0) {
      port = this.freeList.pop();
    } else if (this.nextFresh <= this.end) {
      port = this.nextFresh++;
    } else {
      // pool exhausted — caller must evict (or accept null)
      return null;
    }
    this.bySlot.set(slotId, { port, lastActive: Date.now() });
    this.byPort.set(port, slotId);
    return port;
  }

  /** Touch a slot's lastActive — call on every API hit. */
  touch(slotId) {
    const ent = this.bySlot.get(slotId);
    if (ent) ent.lastActive = Date.now();
  }

  /** Release a specific slot's port back to the pool. Returns true if released. */
  release(slotId) {
    const ent = this.bySlot.get(slotId);
    if (!ent) return false;
    this.bySlot.delete(slotId);
    this.byPort.delete(ent.port);
    this.freeList.push(ent.port);
    return true;
  }

  /** Sweep idle slots (lastActive older than idleMs). Returns array of released slot_ids. */
  sweep(nowMs = Date.now()) {
    const released = [];
    for (const [slotId, ent] of this.bySlot) {
      if (nowMs - ent.lastActive > this.idleMs) {
        released.push(slotId);
      }
    }
    for (const s of released) this.release(s);
    return released;
  }

  /** LRU eviction of N oldest entries — used when pool exhausted and a new alloc requested. */
  evictLRU(count = 1) {
    const sorted = [...this.bySlot.entries()].sort((a, b) => a[1].lastActive - b[1].lastActive);
    const evicted = [];
    for (let i = 0; i < count && i < sorted.length; i++) {
      const [slotId] = sorted[i];
      this.release(slotId);
      evicted.push(slotId);
    }
    return evicted;
  }

  stats() {
    return {
      capacity: this.end - this.start + 1,
      allocated: this.bySlot.size,
      free: this.freeList.length + (this.end - this.nextFresh + 1),
      range: `${this.start}-${this.end}`,
    };
  }
}

export default PortPool;

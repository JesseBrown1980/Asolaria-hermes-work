# Hermes kernel fleets (10k / 20k / 100k) + stubbed rooms (rooms-as-RAM)

The Hermes/HyperBEHCS work runs a **kernel fleet over STUBBED ROOMS** — rooms held as descriptor
stubs and materialized on demand (the rooms-as-RAM / distributed-VRAM model). Scales found:

## Kernel fleets
- **10K micro-kernel cascade** — `kernel-fleet/fire-10k-micro-kernel-cascade-2026-05-28.mjs`
  (the 10K micro-kernel cascade; fires ~4M agents) + `asolaria-micro-kernels-v1/` (manifest + cascade
  results — corpus, not published).
- **Linux kernel target** — `/root/asolaria-kernel-target-linux/` (WSL) — the Rust agent server
  compiled for Linux (`debug/libasolaria_server_agent_*`). Build artifacts/binaries not published.
- registered kernel citizens: `sup-usb-kernel`, `usb-AMC-USB-KERNEL-PID-SLOT7`,
  `usb-AMC-USB-MICROKERNEL-PID-SLOT8`, `prof-PROF-KERNEL`, `sub-KERNEL-BOBBY-FISCHER`.

## Stubbed rooms (rooms-as-RAM)
- **10,000 room-rotor** — `room-rotor/hyperbehcs-d-drive-10000-room-rotor.mjs` (+ unit test + report)
  and `Asolaria-HyperBEHCS-10000-RoomRotor/hyperbehcs-carry-quant-10000/` (sub-planes: authority /
  automation / manifest / planes / quant / **rooms** — the carried 10k rooms; the `.hbp` room/quant
  bytes are corpus and not published; `CARRY_SHAPE_INVENTORY.md` + `rotor-report.md` are included).
- **20,000 whiteroom** — `asolaria-acer/whiteroom/mints/` (~20k mints — corpus, not published) +
  `asolaria-whiteroom/`; registered `servant-SERVANT-OMNIWHITEROOM`.
- **100K scaled rotor** — registered `sub-ROOM-SECTOR-100K-SCALED-ROTOR` + `sup-cluster_roomrotor_manifest`.
- **Room-sector fleet (registered first-class citizens):** ~**100 `ROOM-SECTOR-SHARD-NNNN`** + **12
  `ROOM-SECTOR-LANE-*`** (carry_z / gc / gnn / gulp / indexer / minting / quant / reflex / shannon /
  super_gulp / watcher / white_room) + the BH-ROOM PIDs (review / scout / test-report / write).

## Carve-out
This file is the **map**. The room/quant/mint **`.hbp`/`.hex` corpus**, the PID-office registered
**bytes**, and the WSL **compiled binaries** are NOT published (sovereign / corpus / build-artifact
rule) — only the code, docs, reports, and this manifest. Counts/names are public coordination.

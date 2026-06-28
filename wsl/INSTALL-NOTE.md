# Hermes agent — WSL/Ubuntu install

The Hermes agent is installed in WSL at `/usr/local/lib/hermes-agent/` (gateway:
`scripts/hermes-gateway`, `hermes_state.py`, `environments/hermes_base_env.py` + `hermes_swe_env`)
plus a uv editable install `hermes_agent-0.13.0`. That tree is the **upstream** NousResearch
agent (vendored) and is NOT republished here; our annotation `wsl/hermes-already-has-routines.md`
is included. Our Asolaria-side spindle/dispatcher/agent work is under `asolaria/` + `asolaria-acer/`.

# Implementation Plan (deprecated)

This file previously described an "MVP v2" build-out — full version history with
timeline/branch/merge, a Node Map module, IndexedDB snapshot storage, and other
features that were never built. It does not match the shipped code.

It has been emptied to keep the documentation honest. **The orchestrator should
consider deleting this file** — the actual near-term plan now lives in one
place, [ROADMAP.md](./ROADMAP.md), and current status in
[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

What actually shipped in the "version history" space: undo/redo backed by a
bounded (100-entry) snapshot stack in the Zustand store (Ctrl+Z /
Ctrl+Shift+Z / Ctrl+Y), plus optional Supabase cloud autosave. There is no
timeline UI, branching, or IndexedDB layer.

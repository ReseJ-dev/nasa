// Single entry point to the store for everything in src/twin.
// For now it re-exports the mock store; at integration only this file changes.
// The shared store (../../../src/store/useHealthStore) does not yet provide threats, alerts,
// history, patch() or setThreatLevel(), which the twin and the dev demo use, so it is not wired in.
export { useHealthStore } from './mockStore'

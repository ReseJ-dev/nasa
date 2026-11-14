import { create } from 'zustand'
import { initializeHealthStore, type HealthStore } from '../../../src/store/useHealthStore'

export type { ScenarioId } from '../../../src/store/useHealthStore'
export const useHealthStore = create<HealthStore>()(initializeHealthStore)

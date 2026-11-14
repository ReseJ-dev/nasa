import { useMemo } from 'react'
import type { ThreatId } from '../../contract/types'
import { useHealthStore } from '../store'
import { THREAT_ACTIVE_THRESHOLD } from '../config'

export interface ActiveThreat {
  id: ThreatId
  level: number // 0..1
}

const ORDER: ThreatId[] = ['radiation', 'isolation', 'gravity', 'distance', 'environment']
const NONE: ActiveThreat[] = []

// Threats with level >= THREAT_ACTIVE_THRESHOLD, in a fixed order, with their levels.
// Stable result: the selector returns the store's own `threats` object (changes only
// when the data changes), and the list is rebuilt only then. Safe as an effect dependency.
// All threat effects in the scene should read threats through this hook.
export function useActiveThreats(): ActiveThreat[] {
  const threats = useHealthStore((s) => s.threats)
  return useMemo(() => {
    if (!threats) return NONE
    const active = ORDER.filter((id) => threats[id].level >= THREAT_ACTIVE_THRESHOLD).map((id) => ({
      id,
      level: threats[id].level,
    }))
    return active.length ? active : NONE
  }, [threats])
}

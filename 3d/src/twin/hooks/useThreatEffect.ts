import type { ThreatId } from '../../contract/types'
import { useSceneStore } from '../sceneStore'
import { THREAT_BACKGROUND_EMPHASIS } from '../config'
import { useActiveThreats } from './useActiveThreats'
import { useFocusedThreat } from './useFocusedThreat'

// How strongly a threat's 3D effect should show, built on useActiveThreats + useFocusedThreat:
// 0 = threat not active (below THREAT_ACTIVE_THRESHOLD), effect off;
// 1 = active and focused, or demo mode: full effect;
// THREAT_BACKGROUND_EMPHASIS = active but not focused: faint background version.
// Every threat effect multiplies its strength by this value.
export function useThreatEffect(id: ThreatId): number {
  const active = useActiveThreats().some((t) => t.id === id)
  const focused = useFocusedThreat() === id
  const demo = useSceneStore((s) => s.demo)
  if (!active) return 0
  return focused || demo ? 1 : THREAT_BACKGROUND_EMPHASIS
}

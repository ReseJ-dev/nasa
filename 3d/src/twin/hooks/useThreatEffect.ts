import type { ThreatId } from '../../contract/types'
import { useSceneStore } from '../sceneStore'
import { THREAT_BACKGROUND_EMPHASIS, THREAT_DIMMED_EMPHASIS } from '../config'
import { useActiveThreats } from './useActiveThreats'
import { useFocusedThreat } from './useFocusedThreat'

// How strongly a threat's 3D effect should show, built on useActiveThreats + useFocusedThreat:
// 0 = threat not active (below THREAT_ACTIVE_THRESHOLD), effect off;
// 1 = active and focused, or demo mode: full effect;
// THREAT_BACKGROUND_EMPHASIS = active, nothing focused: faint background version;
// THREAT_DIMMED_EMPHASIS = active while another threat is focused: one accent at a time.
// Every threat effect multiplies its strength by this value.
export function useThreatEffect(id: ThreatId): number {
  const active = useActiveThreats().some((t) => t.id === id)
  const focus = useFocusedThreat()
  const demo = useSceneStore((s) => s.demo)
  if (!active) return 0
  if (focus === id || demo) return 1
  return focus === null ? THREAT_BACKGROUND_EMPHASIS : THREAT_DIMMED_EMPHASIS
}

import type { ThreatId } from '../../contract/types'
import { useSceneStore } from '../sceneStore'

// The one focused threat: the hovered one (preview) wins over the pinned one.
// null = no threat in focus.
export function useFocusedThreat(): ThreatId | null {
  return useSceneStore((s) => s.hoverThreat ?? s.pinnedThreat)
}

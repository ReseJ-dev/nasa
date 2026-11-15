import { Html } from '@react-three/drei'
import { useHealthStore } from './store'
import { EFFECTS, FLUID_SHIFT as F } from './config'
import { FLUID_SHIFT_LABEL } from './labels'
import { useThreatEffect } from './hooks/useThreatEffect'
import { overlayStyles as s } from './overlayStyles'

// Label for the fluid shift visual (shell tint toward the head, SANS glow at the eyes).
// It belongs to the gravity threat, so it has its own place (left of the head) and style and is
// never drawn as a cause label between chain organs (the CO2 chain keeps its own labels).
export function FluidShiftLabel({ visible }: { visible: boolean }) {
  const fluid = useHealthStore((st) => st.fluidShift ?? 0)
  const effect = useThreatEffect('gravity')
  const show = visible && EFFECTS.fluidShift && effect > 0 && fluid >= F.labelFrom
  if (!show) return null
  return (
    <Html position={F.labelPosition} center style={{ pointerEvents: 'none' }}>
      <div style={s.fluidShiftLabel} data-testid="fluid-shift-label">
        ↑ {FLUID_SHIFT_LABEL}
      </div>
    </Html>
  )
}

import { BodyScene } from './twin'
import { useHealthStore, type ScenarioId } from './twin/mockStore'
import { DEV_PANEL, REGION_LABEL } from './twin/labels'

// TEMPORARY test panel: switch scenarios and show the selected region.
const SCENARIO_BUTTONS: ScenarioId[] = ['healthy', 'day60', 'critical']

function TestPanel() {
  const scenario = useHealthStore((s) => s.scenario)
  const setScenario = useHealthStore((s) => s.setScenario)
  const selected = useHealthStore((s) => s.selectedRegion)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16, // top-left is taken by the FPS counter
        left: 16,
        padding: 12,
        borderRadius: 8,
        background: 'rgba(10, 14, 24, 0.8)',
        color: '#fff',
        font: '14px system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {SCENARIO_BUTTONS.map((id) => (
          <button
            key={id}
            onClick={() => setScenario(id)}
            style={{ fontWeight: scenario === id ? 'bold' : 'normal' }}
          >
            {DEV_PANEL.scenario[id]}
          </button>
        ))}
      </div>
      <div>
        {DEV_PANEL.selectedRegion}: {selected ? REGION_LABEL[selected] : DEV_PANEL.none}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <BodyScene showFps />
      <TestPanel />
    </div>
  )
}

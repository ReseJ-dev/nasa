import type { CSSProperties } from 'react'

// Styles of the HTML overlay drawn on top of the canvas (legend and hint).
// pointerEvents: 'none' so the overlay never blocks rotating or clicking the scene.
const panel: CSSProperties = {
  position: 'absolute',
  bottom: 16,
  padding: '8px 12px',
  borderRadius: 8,
  background: 'rgba(10, 14, 24, 0.8)',
  color: '#fff',
  font: '13px system-ui, sans-serif',
  pointerEvents: 'none',
}

export const overlayStyles = {
  legend: { ...panel, right: 16, display: 'flex', gap: 14, alignItems: 'center' },
  legendItem: { display: 'flex', gap: 6, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: '50%' },
  scale: { display: 'flex', flexDirection: 'column', gap: 4, width: 180 },
  scaleBar: { height: 8, borderRadius: 4 },
  scaleLabels: { display: 'flex', justifyContent: 'space-between' },
  hint: {
    ...panel,
    left: '50%',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.6s ease',
  },
} satisfies Record<string, CSSProperties>

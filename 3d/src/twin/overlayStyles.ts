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
  // Permanent callout label next to the body; `side` decides which edge touches the line end.
  callout: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 4,
    background: 'rgba(10, 14, 24, 0.85)',
    color: '#fff',
    font: '12px system-ui, sans-serif',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  calloutLeft: { transform: 'translate(-100%, -50%)' }, // right edge at the line end
  calloutRight: { transform: 'translate(0, -50%)' }, // left edge at the line end
  calloutScore: { fontWeight: 600 },
  // Five threats strip, top-left. Interactive (hover/click), unlike the other overlay parts.
  threats: {
    ...panel,
    bottom: undefined,
    left: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 6,
    pointerEvents: 'auto',
  },
  threat: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#fff',
    font: '13px system-ui, sans-serif',
    cursor: 'pointer',
    textAlign: 'left',
  },
  threatActive: { background: 'rgba(79, 163, 255, 0.35)' },
  threatName: { flex: 1, whiteSpace: 'nowrap' },
  threatLevel: { minWidth: 36, textAlign: 'right', fontWeight: 600 },
  // Cause label between two chain organs (e.g. "CO₂ ↑").
  chainLabel: {
    padding: '2px 8px',
    borderRadius: 10,
    background: 'rgba(10, 14, 24, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.35)',
    color: '#fff',
    font: 'italic 12px system-ui, sans-serif',
    whiteSpace: 'nowrap',
    opacity: 0, // faded in by ChainLinks
  },
  hint: {
    ...panel,
    left: '50%',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.6s ease',
  },
} satisfies Record<string, CSSProperties>

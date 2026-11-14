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
  // Five threats strip, top center. Interactive (hover/click), unlike the other overlay parts.
  threats: {
    position: 'absolute',
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    borderRadius: 10,
    background: 'rgba(10, 14, 24, 0.6)',
    pointerEvents: 'auto',
  },
  threatArcs: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' },
  threat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '0 2px 6px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#fff',
    font: '11px system-ui, sans-serif',
    lineHeight: 1.2,
    cursor: 'pointer',
    textAlign: 'center',
  },
  threatFocused: { background: 'rgba(79, 163, 255, 0.3)' },
  threatOfSelected: { boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.7)' }, // includes the selected region
  threatLevel: { fontWeight: 600, opacity: 0.85 },
  // Full-size SVG over the canvas for lines from the focused icon toward its regions.
  focusLines: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
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
  // Cabin sensor chip on the habitat wall.
  sensor: {
    padding: '2px 7px',
    borderRadius: 4,
    border: '1px solid',
    background: 'rgba(10, 14, 24, 0.8)',
    font: '600 11px system-ui, sans-serif',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  // Circadian ring near the brain.
  circadian: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: '#fff',
    font: '11px system-ui, sans-serif',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  // Label under the small Earth ("Reply in N min").
  earthLabel: {
    padding: '2px 7px',
    borderRadius: 4,
    background: 'rgba(10, 14, 24, 0.75)',
    font: '600 11px system-ui, sans-serif',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  // "Autonomous mode" above the body when the link to Earth is down.
  autonomyLabel: {
    padding: '3px 10px',
    borderRadius: 4,
    border: '1px solid #ff3b30',
    background: 'rgba(120, 16, 10, 0.8)',
    color: '#fff',
    font: '600 13px system-ui, sans-serif',
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  hint: {
    ...panel,
    left: '50%',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.6s ease',
  },
} satisfies Record<string, CSSProperties>

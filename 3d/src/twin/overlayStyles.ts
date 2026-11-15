import type { CSSProperties } from 'react'
import { FONT } from './theme'

// Styles of the HTML overlay drawn on top of the canvas (legend and hint).
// Colors, sizes and radii are design tokens (theme.css); nothing here is a raw value.
// pointerEvents: 'none' so the overlay never blocks rotating or clicking the scene.
const panel: CSSProperties = {
  position: 'absolute',
  bottom: 12,
  padding: 'var(--sp-1) var(--sp-3)',
  borderRadius: 'var(--r-2)',
  background: 'var(--bg-overlay)',
  color: 'var(--text-2)',
  font: FONT.caption,
  pointerEvents: 'none',
}

export const overlayStyles = {
  legend: { ...panel, bottom: 'auto', top: 12, left: 12, display: 'flex', gap: 14, alignItems: 'center' },
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
    padding: '2px var(--sp-2)',
    borderRadius: 'var(--r-1)',
    background: 'var(--bg-overlay)',
    color: 'var(--text-1)',
    font: FONT.caption,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  calloutLeft: { transform: 'translate(-100%, -50%)' }, // right edge at the line end
  calloutRight: { transform: 'translate(0, -50%)' }, // left edge at the line end
  calloutScore: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  // Five threats strip: its own row above the 3D stage. Interactive (hover / click).
  threats: {
    position: 'relative',
    flex: 'none',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    borderRadius: 'var(--r-3)',
    background: 'var(--bg-panel)',
    border: '1px solid var(--line)',
  },
  // Presentation: a narrow centered row, no panel, so the twin below stays the hero.
  threatsCompact: { alignSelf: 'center', width: 'min(100%, 52rem)', background: 'transparent', border: 'none' },
  threatArcs: { position: 'absolute', top: 0, left: 0, width: '100%', pointerEvents: 'none', overflow: 'visible' },
  threat: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-2)',
    minWidth: 0,
    padding: 'var(--sp-1) var(--sp-1) var(--sp-2)',
    border: 'none',
    borderRadius: 'var(--r-2)',
    background: 'transparent',
    color: 'var(--text-1)',
    font: FONT.caption,
    lineHeight: 1.25,
    cursor: 'pointer',
    textAlign: 'left',
  },
  threatText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  threatName: { fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  threatFocused: { background: 'var(--bg-raised)' },
  threatOfSelected: { boxShadow: 'inset 0 -2px 0 var(--accent)' }, // includes the selected region: underline
  threatLevel: { color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  threatNoLink: { color: 'var(--st-critical-text)', fontWeight: 700 },
  // Root of the scene: threats row on top, 3D stage below.
  root: { position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' },
  stage: {
    position: 'relative',
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 'var(--r-3)',
    border: '1px solid var(--line)',
  },
  // "Body / Skeleton" switch, top-right corner of the stage.
  layerSwitch: {
    position: 'absolute',
    top: 12,
    right: 12,
    display: 'flex',
    padding: 3,
    gap: 2,
    borderRadius: 'var(--r-2)',
    background: 'var(--bg-overlay)',
    border: '1px solid var(--line-strong)',
    font: FONT.body,
  },
  layerButton: {
    padding: 'var(--sp-1) var(--sp-3)',
    border: 'none',
    borderRadius: 'var(--r-1)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 400,
    color: 'var(--text-2)',
    background: 'transparent',
  },
  layerButtonActive: { color: 'var(--text-1)', fontWeight: 650, background: 'var(--accent-bg)', boxShadow: 'inset 0 0 0 1px var(--accent-line)' },
  // Label shown at a hovered organ, and the fracture-risk label at the weakest bone.
  hoverLabel: {
    padding: '2px var(--sp-2)',
    borderRadius: 'var(--r-1)',
    background: 'var(--bg-overlay)',
    color: 'var(--text-1)',
    font: FONT.caption,
    whiteSpace: 'nowrap',
  },
  // Full-size SVG over the canvas for lines from the focused icon toward its regions.
  focusLines: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  // Cause label between two chain organs (e.g. "CO₂ ↑").
  chainLabel: {
    padding: '2px var(--sp-2)',
    borderRadius: 'var(--r-pill)',
    background: 'var(--bg-overlay)',
    border: '1px solid var(--line-strong)',
    color: 'var(--text-1)',
    font: `italic ${FONT.caption}`,
    whiteSpace: 'nowrap',
    opacity: 0, // faded in by ChainLinks
  },
  // Cabin sensor chip on the habitat wall.
  sensor: {
    padding: '2px var(--sp-2)',
    borderRadius: 'var(--r-1)',
    border: '1px solid',
    background: 'var(--bg-overlay)',
    font: FONT.captionBold,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  // Hologram labels of the isolation visuals: text only, no panel. Exactly two sizes:
  // holoValue for numbers with units, holoCaption for the word above them.
  holo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    pointerEvents: 'none',
    opacity: 0, // faded by the owner in useFrame
    // dark halo: keeps thin text readable over the shell glow and on a projector
    textShadow: '0 0 4px #020309, 0 0 10px #020309, 0 0 2px #020309',
  },
  holoLeft: { transform: 'translate(0, -50%)', alignItems: 'flex-start' }, // label grows to the right
  holoRight: { transform: 'translate(-100%, -50%)', alignItems: 'flex-end' }, // label grows to the left
  holoValue: { font: FONT.value, letterSpacing: 0.2, color: 'var(--text-1)' },
  holoCaption: {
    font: FONT.captionBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'var(--text-2)',
  },
  moodDots: { display: 'flex', gap: 5, padding: '4px 0 2px' },
  moodDot: { boxSizing: 'border-box', borderRadius: '50%', border: '1.5px solid var(--text-2)' },
  // "Autonomous mode" above the body when the link to Earth is down.
  autonomyLabel: {
    padding: '2px var(--sp-3)',
    borderRadius: 'var(--r-1)',
    border: '1px solid var(--hz-distance)',
    background: 'var(--bg-overlay)',
    color: 'var(--hz-distance)',
    font: FONT.captionBold,
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  // Label above the g arrow ("0 g", "0.38 g").
  gravityLabel: {
    padding: '1px var(--sp-2)',
    borderRadius: 'var(--r-1)',
    background: 'var(--bg-overlay)',
    color: 'var(--hz-gravity)',
    font: FONT.captionBold,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  // Full-frame flash at the start of a solar flare (opacity animated by FlareFlash).
  flareFlash: { position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' },
  shelterLabel: {
    padding: '2px var(--sp-2)',
    borderRadius: 'var(--r-1)',
    border: '1px solid var(--hz-radiation)',
    background: 'var(--bg-overlay)',
    color: '#e4d8ff',
    font: FONT.captionBold,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  // "Dose: N%" under the radiation icon during a solar flare.
  doseBadge: {
    marginLeft: 'var(--sp-1)',
    padding: '0 var(--sp-1)',
    borderRadius: 'var(--r-1)',
    background: 'rgba(166, 108, 255, 0.3)',
    color: '#f0e8ff',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  // Colder frame while the link to Earth is down (multiplied over the canvas).
  coldTint: { position: 'absolute', inset: 0, mixBlendMode: 'multiply', pointerEvents: 'none' },
  hint: {
    ...panel,
    left: 12,
    whiteSpace: 'nowrap',
    transition: 'opacity 0.6s ease',
  },
} satisfies Record<string, CSSProperties>

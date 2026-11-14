import { CanvasTexture } from 'three'

// Small textures drawn once at module load, shared by several effects.

// Soft round dot (white, alpha falls off to the edge), for points and sprites.
function createDotTexture() {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}
export const DOT_TEXTURE = createDotTexture()

export const DESIGN_WIDTH = 420
export const DESKTOP_BREAKPOINT = 520

/** Converts a design-pixel constant into the same responsive unit used by CSS. */
export function designRem(value: number): string {
  return `${value}rem`
}

/** Returns the rendered CSS-pixel size of a design-pixel constant. */
export function designPx(value: number): number {
  if (typeof window === 'undefined') return value
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth
  const scale = viewportWidth <= DESKTOP_BREAKPOINT
    ? Math.min(viewportWidth, DESIGN_WIDTH) / DESIGN_WIDTH
    : 1
  return value * scale
}

const DESIGN_WIDTH = 420

const pxPattern = /(-?\d*\.?\d+)px\b/g

const pxToResponsiveRem = {
  postcssPlugin: 'px-to-responsive-rem',
  Declaration(declaration) {
    if (!declaration.value?.includes('px')) return
    if (declaration.prop === 'font-size' && declaration.parent?.selector === ':root') return

    declaration.value = declaration.value.replace(pxPattern, (_, rawValue) => {
      const value = Number(rawValue)
      return value === 0 ? '0' : `${Number(value.toFixed(4))}rem`
    })
  },
}

export default {
  plugins: [pxToResponsiveRem],
}

export { DESIGN_WIDTH }

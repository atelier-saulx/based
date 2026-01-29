import { PropDef } from '../schema/defs/index.js'
import { Include } from './ast.js'

export const prepMain = (
  props: { prop: PropDef; include: Include; start?: number }[],
) => {
  props.sort((a, b) =>
    a.prop.start < b.prop.start ? -1 : a.prop.start === b.prop.start ? 0 : 1,
  )
  let i = 0
  for (const prop of props) {
    prop.start = i
    i += prop.prop.size
  }
}

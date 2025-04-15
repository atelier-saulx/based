import { SchemaType } from '@based/schema'
import { TypeVisual } from './types.js'
import { walkProps } from './utils.js'
import { Ctx } from './ctx.js'

export const makeType = (
  ctx: Ctx,
  type: string,
  schemaType: SchemaType,
): TypeVisual => {
  const collect = {}
  walkProps(schemaType, collect)

  const len = Object.keys(collect).length
  let w = ctx.propWidth

  for (const prop in collect) {
    const textSize = ctx.textWidth(prop)
    if (textSize + 1 > w) {
      w = textSize + 1
    }
  }

  const h = len + 3

  const block: TypeVisual = {
    fit: {},
    x: 0,
    y: 0,
    w,
    h,
    schemaType,
    type,
    props: {
      __self: {
        // @ts-ignore
        type: {},
        name: '__self',
        prop: { type: 'json' },
        x: 0,
        y: -2,
        w,
        h: ctx.propHeight,
        many: false,
        reverseType: '',
        reverseProp: '__self',
        leftAnchor: -1,
        rightAnchor: -1,
        created: false,
      },
    },
  }
  block.props.__self.type = block

  let maxW = block.w
  for (const key in schemaType.props) {
    const w = ctx.textWidth(key)
    if (w > maxW) {
      maxW > w
    }
  }

  ctx.types[type] = block

  let propIndex = 2
  for (const key in collect) {
    const prop = collect[key]
    if (prop.items || prop.ref) {
      const isMany = 'items' in prop
      block.props[key] = {
        type: block,
        name: key,
        prop,
        x: 0,
        y: propIndex * ctx.propHeight,
        w,
        isRef: true,
        h: ctx.propHeight,
        many: isMany,
        reverseType: isMany ? prop.items.ref : prop.ref,
        reverseProp: (isMany ? prop.items.prop : prop.prop) || '__self',
        leftAnchor: -1,
        rightAnchor: w,
        created: false,
      }
      const p = block.props[key]
      p.w = ctx.textWidth(key)
    } else {
      block.props[key] = {
        type: block,
        name: key,
        prop,
        x: 0,
        y: propIndex * ctx.propHeight,
        w,
        isRef: false,
        h: ctx.propHeight,
        many: false,
        created: false,
      }
    }
    propIndex++
  }
  return block
}

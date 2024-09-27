import { SchemaTypeDef, PropDef, EMPTY_MICRO_BUFFER, isType } from './types.js'

const propDefBuffer = (
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
  isEdge?: boolean,
): number[] => {
  const type = prop.typeIndex
  if (prop.len && isType(prop, 'microbuffer')) {
    const buf = Buffer.allocUnsafe(3)
    buf[0] = type
    buf.writeUint16LE(prop.len, 1)
    return [...buf.values()]
  } else if (isType(prop, 'reference') || isType(prop, 'references')) {
    const buf: Buffer = Buffer.allocUnsafe(8)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName]
    prop.inverseTypeId = dstType.id
    buf.writeUInt8(type, 0)
    if (!isEdge) {
      prop.inversePropNumber = dstType.props[prop.inversePropName].prop
      buf[1] = prop.inversePropNumber
    } else {
      buf[1] = 0 // TODO: fix reference
    }
    buf.writeUInt16LE(dstType.id, 2)
    if (prop.edges) {
      const eschema = Object.values(prop.edges)
        .map((prop) => propDefBuffer(schema, prop as PropDef, true))
        .flat(1)
      eschema.unshift(0)
      buf.writeUint32LE(eschema.length, 4)
      return [...buf.values(), ...eschema]
    } else {
      buf.writeUint32LE(0, 4)
      return [...buf.values()]
    }
  } else if (isType(prop, 'string')) {
    return [type, prop.len < 50 ? prop.len : 0]
  } else {
    return [type]
  }
}

// todo rewrite
export function schemaToSelvaBuffer(schema: { [key: string]: SchemaTypeDef }) {
  return Object.values(schema).map((t, i) => {
    const restFields: PropDef[] = []
    let refFields = 0
    for (const f of Object.values(t.props)) {
      if (f.separate) {
        if (f.typeIndex === 13 || f.typeIndex === 14) {
          refFields++
        }
        restFields.push(f)
      }
    }
    restFields.sort((a, b) => a.prop - b.prop)
    return Buffer.from([
      1 + refFields,
      ...propDefBuffer(schema, {
        ...EMPTY_MICRO_BUFFER,
        len: t.mainLen === 0 ? 1 : t.mainLen,
      }),
      ...restFields.map((f) => propDefBuffer(schema, f)).flat(1),
    ])
  })
}

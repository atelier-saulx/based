import { SchemaTypeDef, PropDef, EMPTY_MICRO_BUFFER } from './types.js'

const propDefBuffer = (
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
  isEdge?: boolean,
): number[] => {
  const type = prop.typeIndex
  if (prop.len && type === 17) {
    const buf = Buffer.allocUnsafe(3)
    buf[0] = type
    buf.writeUint16LE(prop.len, 1)
    return [...buf.values()]
  } else if (type === 13 || type === 14) {
    const buf: Buffer = Buffer.allocUnsafe(8)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName]

    // @ts-ignore
    buf.writeUInt8(type + 2 * !!isEdge, 0)
    buf.writeUInt16LE(dstType.id, 1)
    if (!isEdge) {
      prop.inverseTypeId = dstType.id
      prop.inversePropNumber = dstType.props[prop.inversePropName].prop
      buf[3] = prop.inversePropNumber

      if (prop.edges) {
        const eschema = Object.values(prop.edges)
          .map((prop) => propDefBuffer(schema, prop as PropDef, true))
          .flat(1)
        eschema.unshift(0)
        buf.writeUint32LE(eschema.length, 4)
        return [...buf.values(), ...eschema]
      }
    }

    buf.writeUint32LE(0, 4)
    return [...buf.values()]
  } else if (type === 11) {
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

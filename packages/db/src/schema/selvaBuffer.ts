import { SchemaTypeDef, PropDef, EMPTY_MICRO_BUFFER, isType } from './types.js'

const propDefBuffer = (
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
): number[] => {
  const type = prop.typeIndex
  if (prop.len && isType(prop, 'microbuffer')) {
    const buf = Buffer.allocUnsafe(3)
    buf[0] = type
    buf.writeUint16LE(prop.len, 1)
    return [...buf.values()]
  } else if (isType(prop, 'reference') || isType(prop, 'references')) {
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName]
    const buf = Buffer.allocUnsafe(4)
    buf.writeUInt8(type, 0)
    prop.inverseTypeId = dstType.id
    prop.inversePropNumber = dstType.props[prop.inversePropName].prop
    buf[1] = prop.inversePropNumber
    buf.writeUInt16LE(dstType.id, 2)
    return [...buf.values()]
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
    for (const f of Object.values(t.props)) {
      if (f.seperate) {
        restFields.push(f)
      }
    }
    restFields.sort((a, b) => a.prop - b.prop)
    return Buffer.from([
      1,
      ...propDefBuffer(schema, {
        ...EMPTY_MICRO_BUFFER,
        len: t.mainLen === 0 ? 1 : t.mainLen,
      }),
      ...restFields.map((f) => propDefBuffer(schema, f)).flat(1),
    ])
  })
}

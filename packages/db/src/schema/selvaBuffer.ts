import {
  SchemaTypeDef,
  PropDef,
  PropDefEdge,
  EMPTY_MICRO_BUFFER,
  MICRO_BUFFER,
  REFERENCE,
  REFERENCES,
  STRING,
} from './types.js'

function sepPropCount(props: Array<PropDef | PropDefEdge>): number {
  return props.filter((prop) => prop.separate).length
}

const propDefBuffer = (
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
  isEdge?: boolean,
): number[] => {
  const type = prop.typeIndex
  if (prop.len && type === MICRO_BUFFER) {
    const buf = Buffer.allocUnsafe(3)
    buf[0] = type
    buf.writeUint16LE(prop.len, 1)
    return [...buf.values()]
  } else if (type === REFERENCE || type === REFERENCES) {
    const buf: Buffer = Buffer.allocUnsafe(8)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName]
    let eschema = []

    // @ts-ignore
    buf[0] = type + 2 * !!isEdge
    buf.writeUInt16LE(dstType.id, 1)
    buf.writeUint32LE(0, 4)
    if (!isEdge) {
      prop.inverseTypeId = dstType.id
      prop.inversePropNumber = dstType.props[prop.inversePropName].prop
      buf[3] = prop.inversePropNumber

      if (prop.edges) {
        const props = Object.values(prop.edges)
        eschema = props
          .map((prop) => propDefBuffer(schema, prop as PropDef, true))
          .flat(1)
        eschema.unshift(sepPropCount(props), 0)
        buf.writeUint32LE(eschema.length, 4)
      }
    }

    return [...buf.values(), ...eschema]
  } else if (type === STRING) {
    return [type, prop.len < 50 ? prop.len : 0]
  } else {
    return [type]
  }
}

// todo rewrite
export function schemaToSelvaBuffer(schema: { [key: string]: SchemaTypeDef }) {
  return Object.values(schema).map((t, i) => {
    const props = Object.values(t.props)
    const rest: PropDef[] = []
    let refFields = 0
    for (const f of props) {
      if (f.separate) {
        if (f.typeIndex === 13 || f.typeIndex === 14) {
          refFields++
        }
        rest.push(f)
      }
    }
    rest.sort((a, b) => a.prop - b.prop)
    return Buffer.from([
      1 + sepPropCount(props),
      1 + refFields,
      ...propDefBuffer(schema, {
        ...EMPTY_MICRO_BUFFER,
        len: t.mainLen === 0 ? 1 : t.mainLen,
      }),
      ...rest.map((f) => propDefBuffer(schema, f)).flat(1),
    ])
  })
}

import {
  SchemaTypeDef,
  PropDef,
  PropDefEdge,
  ALIAS,
  ALIASES,
  BINARY,
  BOOLEAN,
  CREATED,
  EMPTY_MICRO_BUFFER,
  ENUM,
  CARDINALITY,
  INT16,
  INT32,
  INT64,
  INT8,
  MICRO_BUFFER,
  NULL,
  NUMBER,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
  UPDATED,
  VECTOR,
  WEAK_REFERENCE,
  WEAK_REFERENCES,
} from './types.js'

const selvaTypeMap = []
selvaTypeMap[NULL] = 0
selvaTypeMap[TIMESTAMP] = 1
selvaTypeMap[CREATED] = 1
selvaTypeMap[UPDATED] = 1
selvaTypeMap[NUMBER] = 4
selvaTypeMap[CARDINALITY] = 11
selvaTypeMap[INT8] = 20
selvaTypeMap[UINT8] = 6
selvaTypeMap[INT16] = 21
selvaTypeMap[UINT16] = 22
selvaTypeMap[INT32] = 23
selvaTypeMap[UINT32] = 7
selvaTypeMap[INT64] = 24
selvaTypeMap[BOOLEAN] = 9
selvaTypeMap[ENUM] = 10
selvaTypeMap[STRING] = 11
selvaTypeMap[TEXT] = 12
selvaTypeMap[REFERENCE] = 13
selvaTypeMap[REFERENCES] = 14
selvaTypeMap[WEAK_REFERENCE] = 15
selvaTypeMap[WEAK_REFERENCES] = 16
selvaTypeMap[MICRO_BUFFER] = 17
selvaTypeMap[ALIAS] = 18
selvaTypeMap[ALIASES] = 19
selvaTypeMap[BINARY] = 11
selvaTypeMap[VECTOR] = 17

const EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT = 0x01

function sepPropCount(props: Array<PropDef | PropDefEdge>): number {
  return props.filter((prop) => prop.separate).length
}

function makeEdgeConstraintFlags(prop: PropDef): number {
  return prop.dependent ? EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT : 0x00
}

const propDefBuffer = (
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
  isEdge?: boolean,
): number[] => {
  const type = prop.typeIndex
  const selvaType = selvaTypeMap[type]

  if (prop.len && (type === MICRO_BUFFER || type === VECTOR)) {
    const buf = Buffer.allocUnsafe(3)
    buf[0] = selvaType
    buf.writeUint16LE(prop.len, 1)
    return [...buf.values()]
  } else if (type === REFERENCE || type === REFERENCES) {
    const buf: Buffer = Buffer.allocUnsafe(9)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName]
    let eschema = []
    // @ts-ignore
    buf[0] = selvaType + 2 * !!isEdge // field type
    buf[1] = makeEdgeConstraintFlags(prop) // flags
    buf.writeUInt16LE(dstType.id, 2) // dst_node_type
    buf.writeUint32LE(0, 5) // schema_len
    if (!isEdge) {
      prop.inverseTypeId = dstType.id
      prop.inversePropNumber = dstType.props[prop.inversePropName].prop
      buf[4] = prop.inversePropNumber

      if (prop.edges) {
        const props = Object.values(prop.edges)
        eschema = props
          .map((prop) => propDefBuffer(schema, prop as PropDef, true))
          .flat(1)
        eschema.unshift(0, 0, 0, 0, sepPropCount(props), 0)
        buf.writeUint32LE(eschema.length, 5)
      }
    }

    return [...buf.values(), ...eschema]
  } else if (type === STRING || type == BINARY || type === CARDINALITY) {
    return [selvaType, prop.len < 50 ? prop.len : 0]
  } else {
    return [selvaType]
  }
}

function makeBlockCapacityBuffer(blockCapacity: number): Buffer {
  const buf = Buffer.allocUnsafe(4)
  buf.writeInt32LE(blockCapacity)
  return buf
}

// todo rewrite
export function schemaToSelvaBuffer(schema: { [key: string]: SchemaTypeDef }) {
  return Object.values(schema).map((t, i) => {
    const props = Object.values(t.props)
    const rest: PropDef[] = []
    let refFields = 0
    for (const f of props) {
      if (f.separate) {
        if (f.typeIndex === REFERENCE || f.typeIndex === REFERENCES) {
          refFields++
        }
        rest.push(f)
      }
    }
    rest.sort((a, b) => a.prop - b.prop)
    return Buffer.from([
      ...makeBlockCapacityBuffer(t.blockCapacity).values(),
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

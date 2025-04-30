import {
  SchemaTypeDef,
  PropDef,
  PropDefEdge,
  ALIAS,
  ALIASES,
  BINARY,
  EMPTY_MICRO_BUFFER,
  CARDINALITY,
  MICRO_BUFFER,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  VECTOR,
  WEAK_REFERENCE,
  WEAK_REFERENCES,
  JSON,
} from './types.js'

const selvaTypeMap = new Uint8Array(32) // 1.2x faster than JS array
selvaTypeMap[MICRO_BUFFER] = 1
selvaTypeMap[VECTOR] = 1
selvaTypeMap[BINARY] = 2
selvaTypeMap[CARDINALITY] = 2
selvaTypeMap[JSON] = 2
selvaTypeMap[STRING] = 2
selvaTypeMap[TEXT] = 3
selvaTypeMap[REFERENCE] = 4
selvaTypeMap[REFERENCES] = 5
selvaTypeMap[WEAK_REFERENCE] = 6
selvaTypeMap[WEAK_REFERENCES] = 7
selvaTypeMap[ALIAS] = 8
selvaTypeMap[ALIASES] = 9

const EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT = 0x01
const EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP = 0x80

function blockCapacity(blockCapacity: number): Uint8Array {
  const buf = new Uint8Array(Uint32Array.BYTES_PER_ELEMENT)
  const view = new DataView(buf.buffer)
  view.setUint32(0, blockCapacity, true)
  return buf
}

function sepPropCount(props: Array<PropDef | PropDefEdge>): number {
  return props.filter((prop) => prop.separate).length
}

function makeEdgeConstraintFlags(prop: PropDef, inverseProp: PropDef): number {
  return (prop.dependent ? EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT : 0x00) |
         ((prop.typeIndex === REFERENCE && inverseProp.typeIndex === REFERENCES) ? EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP : 0x00)
}

const propDefBuffer = (
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
  isEdge?: boolean,
): number[] => {
  const type = prop.typeIndex
  const selvaType = selvaTypeMap[type]

  if (prop.len && (type === MICRO_BUFFER || type === VECTOR)) {
    const buf = new Uint8Array(3)
    const view = new DataView(buf.buffer)

    buf[0] = selvaType
    view.setUint16(1, prop.len, true)
    return [...buf]
  } else if (type === REFERENCE || type === REFERENCES) {
    const buf = new Uint8Array(9)
    const view = new DataView(buf.buffer)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName]
    let eschema = []

    // @ts-ignore
    buf[0] = selvaType + 2 * !!isEdge // field type
    buf[1] = makeEdgeConstraintFlags(prop, dstType.props[prop.inversePropName]) // flags
    view.setUint16(2, dstType.id, true) // dst_node_type
    view.setUint32(5, 0, true) // schema_len
    if (!isEdge) {
      prop.inverseTypeId = dstType.id
      prop.inversePropNumber = dstType.props[prop.inversePropName].prop
      buf[4] = prop.inversePropNumber

      if (prop.edges) {
        const edgesS = Object.values(prop.edges)
        if (edgesS.length) {
          const props = edgesS
            .filter((v) => v.separate === true)
            .sort((a, b) => (a.prop > b.prop ? 1 : -1))
          const p = [
            {
              ...EMPTY_MICRO_BUFFER,
              len: prop.edgeMainLen || 1, // allow zero here... else useless padding
              __isEdgeDef: true,
            },
            // or handle this here...
            ...props,
          ]
          eschema = p
            .map((prop) => propDefBuffer(schema, prop as PropDef, true))
            .flat(1)
          eschema.unshift(0, 0, 0, 0, sepPropCount(p), 0)
          view.setUint32(5, eschema.length, true)
        }
      }
    }

    return [...buf, ...eschema]
  } else if (
    type === STRING ||
    type === BINARY ||
    type === CARDINALITY ||
    type === JSON
  ) {
    return [selvaType, prop.len < 50 ? prop.len : 0]
  }
  {
    return [selvaType]
  }
}

// TODO rewrite
export function schemaToSelvaBuffer(schema: {
  [key: string]: SchemaTypeDef
}): ArrayBuffer[] {
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
    return Uint8Array.from([
      ...blockCapacity(t.blockCapacity),
      1 + sepPropCount(props),
      1 + refFields,
      ...propDefBuffer(schema, {
        ...EMPTY_MICRO_BUFFER,
        len: t.mainLen === 0 ? 1 : t.mainLen,
      }),
      ...rest.map((f) => propDefBuffer(schema, f)).flat(1),
    ]).buffer
  })
}

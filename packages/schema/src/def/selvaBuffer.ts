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
  JSON,
  COLVEC,
  VECTOR_BASE_TYPE_SIZE_MAP,
} from './types.js'
import RefSet from './refSet.js'

const selvaFieldType: Readonly<Record<string, number>> = {
  NULL: 0,
  MICRO_BUFFER: 1,
  STRING: 2,
  TEXT: 3,
  REFERENCE: 4,
  REFERENCES: 5,
  ALIAS: 8,
  ALIASES: 9,
  COLVEC: 10,
}

const selvaTypeMap = new Uint8Array(32) // 1.2x faster than JS array
selvaTypeMap[MICRO_BUFFER] = selvaFieldType.MICRO_BUFFER
selvaTypeMap[VECTOR] = selvaFieldType.MICRO_BUFFER
selvaTypeMap[BINARY] = selvaFieldType.STRING
selvaTypeMap[CARDINALITY] = selvaFieldType.STRING
selvaTypeMap[JSON] = selvaFieldType.STRING
selvaTypeMap[STRING] = selvaFieldType.STRING
selvaTypeMap[TEXT] = selvaFieldType.TEXT
selvaTypeMap[REFERENCE] = selvaFieldType.REFERENCE
selvaTypeMap[REFERENCES] = selvaFieldType.REFERENCES
selvaTypeMap[ALIAS] = selvaFieldType.ALIAS
selvaTypeMap[ALIASES] = selvaFieldType.ALIASES
selvaTypeMap[COLVEC] = selvaFieldType.COLVEC

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

function makeEdgeConstraintFlags(
  refSet: RefSet,
  nodeTypeId: number,
  prop: PropDef,
  dstNodeTypeId: number,
  inverseProp: PropDef,
): number {
  let flags = 0

  flags |= prop.dependent ? EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT : 0x00
  flags |=
    prop.typeIndex === REFERENCE &&
    inverseProp &&
    inverseProp.typeIndex === REFERENCES
      ? EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP
      : 0x00

  if (inverseProp) {
    const x = refSet.add(nodeTypeId, prop.prop, dstNodeTypeId, inverseProp.prop)
    flags |= x ? 0x00 : EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP
  }

  return flags
}

const propDefBuffer = (
  refSet: RefSet,
  nodeTypeId: number,
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
): number[] => {
  const type = prop.typeIndex
  const selvaType = selvaTypeMap[type]

  if (prop.len && (type === MICRO_BUFFER || type === VECTOR)) {
    const buf = new Uint8Array(3)
    const view = new DataView(buf.buffer)

    buf[0] = selvaType
    view.setUint16(1, prop.len, true)
    return [...buf]
  } else if (prop.len && type === COLVEC) {
    const buf = new Uint8Array(5)
    const view = new DataView(buf.buffer)

    buf[0] = selvaType
    const baseSize = VECTOR_BASE_TYPE_SIZE_MAP[prop.vectorBaseType]

    view.setUint16(1, prop.len / baseSize, true) // elements
    view.setUint16(3, baseSize, true) // element size
    return [...buf]
  } else if (type === REFERENCE || type === REFERENCES) {
    const buf = new Uint8Array(7)
    const view = new DataView(buf.buffer)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName]

    buf[0] = selvaType // field type
    buf[1] = makeEdgeConstraintFlags(
      refSet,
      nodeTypeId,
      prop,
      dstType.id,
      dstType.props[prop.inversePropName],
    ) // flags
    view.setUint16(2, dstType.id, true) // dst_node_type
    buf[4] = prop.inversePropNumber // inverse_field
    view.setUint16(5, prop.edgeNodeTypeId ?? 0, true) // meta_node_type

    return [...buf]
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
  const refSet = new RefSet()

  return Object.values(schema).map((t) => {
    const props = Object.values(t.props)
    const rest: PropDef[] = []
    const nrFields = 1 + sepPropCount(props)
    let refFields = 0
    let virtualFields = 0

    if (nrFields >= 250) {
      throw new Error('Too many fields')
    }

    for (const f of props) {
      if (f.separate) {
        if (f.typeIndex === REFERENCE || f.typeIndex === REFERENCES) {
          refFields++
        } else if (
          f.typeIndex === ALIAS ||
          f.typeIndex === ALIASES ||
          f.typeIndex === COLVEC
        ) {
          // We assume that these are always the last props!
          virtualFields++
        }
        rest.push(f)
      }
    }

    rest.sort((a, b) => a.prop - b.prop)
    return Uint8Array.from([
      ...blockCapacity(t.blockCapacity), // u32 blockCapacity
      nrFields, // u8 nrFields
      1 + refFields, // u8 nrFixedFields
      virtualFields, // u8 nrVirtualFields
      0, // u8 spare1
      ...propDefBuffer(refSet, t.id, schema, {
        ...EMPTY_MICRO_BUFFER,
        len: t.mainLen === 0 ? 1 : t.mainLen,
      }),
      ...rest.map((f) => propDefBuffer(refSet, t.id, schema, f)).flat(1),
    ]).buffer
  })
}

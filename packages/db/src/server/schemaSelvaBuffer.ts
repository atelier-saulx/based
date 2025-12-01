import {
  convertToTimestamp,
  ENCODER,
  writeDoubleLE,
  writeFloatLE,
  writeUint16,
  writeUint32,
  writeUint64,
} from '@based/utils'
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
  INT8,
  UINT8,
  BOOLEAN,
  INT16,
  UINT16,
  INT32,
  UINT32,
  NUMBER,
  TIMESTAMP,
  ENUM,
} from '@based/schema/def'
import { NOT_COMPRESSED } from '@based/protocol'
import native from '../native.js'

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

function blockCapacity(blockCapacity: number): Uint8Array {
  const buf = new Uint8Array(Uint32Array.BYTES_PER_ELEMENT)
  const view = new DataView(buf.buffer)
  view.setUint32(0, blockCapacity, true)
  return buf
}

function sepPropCount(props: Array<PropDef | PropDefEdge>): number {
  return props.filter((prop) => prop.separate).length
}

function makeEdgeConstraintFlags(prop: PropDef): number {
  let flags = 0

  flags |= prop.dependent ? EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT : 0x00

  return flags
}

const propDefBuffer = (
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
): number[] => {
  const type = prop.typeIndex
  const selvaType = selvaTypeMap[type]

  if (prop.len && (type === MICRO_BUFFER || type === VECTOR)) {
    const buf = new Uint8Array(4)
    const view = new DataView(buf.buffer)

    buf[0] = selvaType
    view.setUint16(1, prop.len, true)
    if (prop.default) {
      buf[3] = 1 // has default
      return [...buf, ...prop.default]
    } else {
      buf[3] = 0 // has default
      return [...buf]
    }
  } else if (prop.len && type === COLVEC) {
    const buf = new Uint8Array(5)
    const view = new DataView(buf.buffer)

    buf[0] = selvaType
    const baseSize = VECTOR_BASE_TYPE_SIZE_MAP[prop.vectorBaseType]

    view.setUint16(1, prop.len / baseSize, true) // elements
    view.setUint16(3, baseSize, true) // element size
    return [...buf]
  } else if (type === REFERENCE || type === REFERENCES) {
    const buf = new Uint8Array(11)
    const view = new DataView(buf.buffer)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName]

    buf[0] = selvaType // field type
    buf[1] = makeEdgeConstraintFlags(prop) // flags
    view.setUint16(2, dstType.id, true) // dst_node_type
    buf[4] = prop.inversePropNumber // inverse_field
    view.setUint16(5, prop.edgeNodeTypeId ?? 0, true) // edge_node_type
    view.setUint32(7, prop.referencesCapped ?? 0, true)

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
  return Object.values(schema).map((t) => {
    const props = Object.values(t.props)
    const rest: PropDef[] = []
    const nrFields = 1 + sepPropCount(props)
    let refFields = 0
    let virtualFields = 0

    if (nrFields >= 250) {
      throw new Error('Too many fields')
    }

    const main = {
      ...EMPTY_MICRO_BUFFER,
      len: t.mainLen === 0 ? 1 : t.mainLen,
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
      } else {
        if (f.default) {
          if (!main.default) {
            main.default = new Uint8Array(main.len)
          }
          const buf = main.default as Uint8Array

          switch (f.typeIndex) {
            case ENUM:
              main.default[f.start] = f.reverseEnum[f.default] + 1
              break
            case INT8:
            case UINT8:
            case BOOLEAN:
              main.default[f.start] = f.default
              break
            case INT16:
            case UINT16:
              writeUint16(buf, f.default, f.start)
              break
            case INT32:
            case UINT32:
              writeUint32(buf, f.default, f.start)
              break
            case NUMBER:
              writeDoubleLE(buf, f.default, f.start)
              break
            case TIMESTAMP:
              writeUint64(buf, f.default, f.start)
              break
            case BINARY:
            case STRING:
              if (f.default instanceof Uint8Array) {
                buf.set(f.default, f.start)
              } else {
                const value = f.default.normalize('NFKD')
                buf[f.start] = 0 // lang
                buf[f.start + 1] = NOT_COMPRESSED
                const { written: l } = ENCODER.encodeInto(
                  value,
                  buf.subarray(f.start + 2),
                )
                let crc = native.crc32(
                  buf.subarray(f.start + 2, f.start + 2 + l),
                )
                writeUint32(buf, crc, f.start + 2 + l)
              }
              break
          }
        }
      }
    }

    rest.sort((a, b) => a.prop - b.prop)
    return Uint8Array.from([
      ...blockCapacity(t.blockCapacity), // u32 blockCapacity
      nrFields, // u8 nrFields
      1 + refFields, // u8 nrFixedFields
      virtualFields, // u8 nrVirtualFields
      7, // u8 version (generally follows the sdb version)
      ...propDefBuffer(schema, main),
      ...rest.map((f) => propDefBuffer(schema, f)).flat(1),
    ]).buffer
  })
}

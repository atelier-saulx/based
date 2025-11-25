import {
  writeDoubleLE,
  writeUint16,
  writeUint32,
  writeUint64,
} from '../utils/index.js'
import native from '../native.js'
import { PropType } from '../zigTsExports.js'
import {
  EMPTY_MICRO_BUFFER,
  VECTOR_BASE_TYPE_SIZE_MAP,
  type PropDef,
  type PropDefEdge,
  type SchemaTypeDef,
} from '../schema/index.js'
import { NOT_COMPRESSED } from '../protocol/index.js'
import { TypeIndex } from '../schema/def/typeIndexes.js'

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
selvaTypeMap[PropType.microBuffer] = selvaFieldType.MICRO_BUFFER
selvaTypeMap[PropType.vector] = selvaFieldType.MICRO_BUFFER
selvaTypeMap[PropType.binary] = selvaFieldType.STRING
selvaTypeMap[PropType.cardinality] = selvaFieldType.STRING
selvaTypeMap[PropType.json] = selvaFieldType.STRING
selvaTypeMap[PropType.string] = selvaFieldType.STRING
selvaTypeMap[PropType.text] = selvaFieldType.TEXT
selvaTypeMap[PropType.reference] = selvaFieldType.REFERENCE
selvaTypeMap[PropType.references] = selvaFieldType.REFERENCES
selvaTypeMap[PropType.alias] = selvaFieldType.ALIAS
selvaTypeMap[PropType.aliases] = selvaFieldType.ALIASES
selvaTypeMap[PropType.colVec] = selvaFieldType.COLVEC

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

function setDefaultString(dst: Uint8Array, s: Uint8Array | string, offset: number): void {
  if (s instanceof Uint8Array) {
    dst.set(s, offset)
  } else {
    const value = s.normalize('NFKD')
    dst[offset] = 0 // lang
    dst[offset + 1] = NOT_COMPRESSED
    const l = native.stringToUint8Array(value, dst, offset + 2)
    let crc = native.crc32(
      dst.subarray(offset + 2, offset + 2 + l),
    )
    writeUint32(dst, crc, offset + 2 + l)
  }
}

const propDefBuffer = (
  schema: { [key: string]: SchemaTypeDef },
  prop: PropDef,
): number[] => {
  const type = prop.typeIndex
  const selvaType = selvaTypeMap[type]

  if (prop.len && (type === PropType.microBuffer || type === PropType.vector)) {
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
  } else if (prop.len && type === PropType.colVec) {
    const buf = new Uint8Array(5)
    const view = new DataView(buf.buffer)

    buf[0] = selvaType
    const baseSize = VECTOR_BASE_TYPE_SIZE_MAP[prop.vectorBaseType!]

    view.setUint16(1, prop.len / baseSize, true) // elements
    view.setUint16(3, baseSize, true) // element size
    return [...buf]
  } else if (type === PropType.reference || type === PropType.references) {
    const buf = new Uint8Array(11)
    const view = new DataView(buf.buffer)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName!]

    buf[0] = selvaType // field type
    buf[1] = makeEdgeConstraintFlags(prop) // flags
    view.setUint16(2, dstType.id, true) // dst_node_type
    buf[4] = prop.inversePropNumber! // inverse_field
    view.setUint16(5, prop.edgeNodeTypeId ?? 0, true) // edge_node_type
    view.setUint32(7, prop.referencesCapped ?? 0, true)

    return [...buf]
  } else if (
    type === PropType.string ||
    type === PropType.binary ||
    type === PropType.cardinality ||
    type === PropType.json
  ) {
    const defaultLen = prop.default instanceof Uint8Array ? prop.default.byteLength : native.stringByteLength(prop.default) + 2
    const buf = new Uint8Array(6 + defaultLen)

    buf[0] = selvaType
    buf[1] = prop.len < 50 ? prop.len : 0
    writeUint32(buf, defaultLen, 2)
    setDefaultString(buf, prop.default, 6)

    return [...buf]
  }
  return [selvaType]
}

// TODO rewrite
export function schemaToSelvaBuffer(schema: {
  [key: string]: SchemaTypeDef
}): ArrayBuffer[] {
  return Object.values(schema).map((t) => {
    const props = Object.values(t.props)
    const rest: PropDef[] = []
    const nrFields = 1 + sepPropCount(props)
    let nrFixedFields = 1
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
        if (
          f.typeIndex === PropType.reference ||
          f.typeIndex === PropType.references
        ) {
          nrFixedFields++
        } else if (
          f.typeIndex === PropType.alias ||
          f.typeIndex === PropType.aliases ||
          f.typeIndex === PropType.colVec
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
            case PropType.int8:
            case PropType.uint8:
            case PropType.boolean:
            case PropType.enum:
              main.default[f.start] = f.default
              break
            case PropType.int16:
            case PropType.uint16:
              writeUint16(buf, f.default, f.start)
              break
            case PropType.int32:
            case PropType.uint32:
              writeUint32(buf, f.default, f.start)
              break
            case PropType.number:
              writeDoubleLE(buf, f.default, f.start)
              break
            case PropType.timestamp:
              writeUint64(buf, f.default, f.start)
              break
            case PropType.binary:
            case PropType.string:
              setDefaultString(buf, f.default, f.start)
              break
          }
        }
      }
    }

    // Add props with defaults as fixed
    const supportedDefaults: TypeIndex[] = [
        PropType.binary,
        PropType.string,
    ]
    nrFixedFields += rest.reduce((prev, prop) => prev + ((supportedDefaults.includes(prop.typeIndex) && prop.default) ? 1 : 0), 0)

    rest.sort((a, b) => a.prop - b.prop)
    return Uint8Array.from([
      ...blockCapacity(t.blockCapacity), // u32 blockCapacity
      nrFields, // u8 nrFields
      nrFixedFields, // u8 nrFixedFields
      virtualFields, // u8 nrVirtualFields
      8, // u8 version (generally follows the sdb version)
      ...propDefBuffer(schema, main),
      ...rest.map((f) => propDefBuffer(schema, f)).flat(1),
    ]).buffer
  })
}

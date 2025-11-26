import {
    writeUint16,
    writeUint32,
} from '../utils/index.js'
import native from '../native.js'
import { LangCode, PropType, PropTypeEnum } from '../zigTsExports.js'
import {
  EMPTY_MICRO_BUFFER,
  VECTOR_BASE_TYPE_SIZE_MAP,
  type PropDef,
  type PropDefEdge,
  type SchemaTypeDef,
} from '../schema/index.js'
import { writeRaw as writeString } from '../db-client/string.js'
import { fillEmptyMain } from '../schema/def/fillEmptyMain.js'

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

const supportedDefaults = new Set<PropTypeEnum>([
  PropType.binary,
  PropType.string,
  PropType.vector,
  PropType.json, // same as binary (Uint8Array)
])

function blockCapacity(blockCapacity: number): Uint8Array {
  const buf = new Uint8Array(Uint32Array.BYTES_PER_ELEMENT)
  writeUint32(buf, blockCapacity, 0)
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

  if (prop.len && (type === PropType.microBuffer || type === PropType.vector)) {
    const buf = new Uint8Array(4)

    buf[0] = selvaType
    writeUint16(buf, prop.len, 1)
    if (prop.default) {
      buf[3] = 1 // has default
      return [...buf, ...prop.default]
    } else {
      buf[3] = 0 // has default
      return [...buf]
    }
  } else if (prop.len && type === PropType.colVec) {
    const buf = new Uint8Array(5)

    buf[0] = selvaType
    const baseSize = VECTOR_BASE_TYPE_SIZE_MAP[prop.vectorBaseType!]

    writeUint16(buf, prop.len / baseSize, 1) // elements
    writeUint16(buf, baseSize, 3) // element size
    return [...buf]
  } else if (type === PropType.reference || type === PropType.references) {
    const buf = new Uint8Array(11)
    const dstType: SchemaTypeDef = schema[prop.inverseTypeName!]

    buf[0] = selvaType // field type
    buf[1] = makeEdgeConstraintFlags(prop) // flags
    writeUint16(buf, dstType.id, 2) // dst_node_type
    buf[4] = prop.inversePropNumber! // inverse_field
    writeUint16(buf, prop.edgeNodeTypeId ?? 0, 5) // edge_node_type
    writeUint32(buf, prop.referencesCapped ?? 0, 7)

    return [...buf]
  } else if (
    type === PropType.string ||
    type === PropType.binary ||
    type === PropType.cardinality ||
    type === PropType.json
  ) {
    if (prop.default && supportedDefaults.has(type)) {
        const STRING_EXTRA_MAX = 10
        const defaultLen = prop.default instanceof Uint8Array ? prop.default.byteLength : 2 * native.stringByteLength(prop.default) + STRING_EXTRA_MAX
        let buf = new Uint8Array(6 + defaultLen)

        buf[0] = selvaType
        buf[1] = prop.len < 50 ? prop.len : 0
        const l = writeString(buf, prop.default, 6, LangCode.none, false)
        if (l != buf.length) {
          buf = buf.subarray(0, 6 + l)
        }
        writeUint32(buf, l, 2) // default len

      return [...buf]
    } else {
      const buf = new Uint8Array(6)

      buf[0] = selvaType
      buf[1] = prop.len < 50 ? prop.len : 0
      writeUint32(buf, 0, 2) // no default

      return [...buf]
    }
  }
  return [selvaType]
}

export function schemaToSelvaBuffer(schema: {
  [key: string]: SchemaTypeDef
}): ArrayBuffer[] {
  return Object.values(schema).map((t) => {
    const props: PropDef[] = Object.values(t.props)
    const rest: PropDef[] = []
    const nrFields = 1 + sepPropCount(props)
    let nrFixedFields = 1
    let virtualFields = 0

    if (nrFields >= 250) {
      throw new Error('Too many fields')
    }

    const mainLen = t.mainLen === 0 ? 1 : t.mainLen
    const main = {
      ...EMPTY_MICRO_BUFFER,
      default: fillEmptyMain(props, mainLen),
      len: mainLen,
    }

    for (const f of props) {
      if (!f.separate) {
        continue
      }

      if (f.default && supportedDefaults.has(f.typeIndex)) {
        nrFixedFields++
      } else if (
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
    }

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

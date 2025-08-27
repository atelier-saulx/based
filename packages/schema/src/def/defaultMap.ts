import { TypeIndex, TYPE_INDEX_MAP } from './types.js'

// TODO update defaults
export const DEFAULT_MAP: Record<TypeIndex, any> = {
  [TYPE_INDEX_MAP.alias]: '',
  [TYPE_INDEX_MAP.binary]: new Uint8Array([]),
  [TYPE_INDEX_MAP.boolean]: false,
  [TYPE_INDEX_MAP.cardinality]: [],
  [TYPE_INDEX_MAP.number]: 0,
  [TYPE_INDEX_MAP.timestamp]: 0,
  [TYPE_INDEX_MAP.enum]: 0,
  [TYPE_INDEX_MAP.id]: 0,
  [TYPE_INDEX_MAP.int16]: 0,
  [TYPE_INDEX_MAP.int32]: 0,
  [TYPE_INDEX_MAP.int8]: 0,
  [TYPE_INDEX_MAP.uint8]: 0,
  [TYPE_INDEX_MAP.uint16]: 0,
  [TYPE_INDEX_MAP.uint32]: 0,
  [TYPE_INDEX_MAP.json]: null,
  [TYPE_INDEX_MAP.microbuffer]: undefined,
  [TYPE_INDEX_MAP.reference]: undefined,
  [TYPE_INDEX_MAP.references]: [],
  [TYPE_INDEX_MAP.string]: '',
  [TYPE_INDEX_MAP.aliases]: [],
  [TYPE_INDEX_MAP.text]: {},
  [TYPE_INDEX_MAP.vector]: undefined, // maybe not can set a vec with 0
  [TYPE_INDEX_MAP.colvec]: undefined, // maybe not can set a vec with 0
}

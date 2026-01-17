import { PropType, PropTypeEnum } from '../../zigTsExports.js'

export const DEFAULT_MAP: Record<PropTypeEnum, any> = {
  [PropType.null]: 0,
  [PropType.object]: 0,
  [PropType.alias]: '',
  [PropType.binary]: new Uint8Array(),
  [PropType.binaryFixed]: new Uint8Array(),
  [PropType.boolean]: false,
  [PropType.cardinality]: [],
  [PropType.number]: 0,
  [PropType.timestamp]: 0,
  [PropType.created]: 0,
  [PropType.updated]: 0,
  [PropType.enum]: 0,
  [PropType.id]: 0,
  [PropType.int16]: 0,
  [PropType.int32]: 0,
  [PropType.int8]: 0,
  [PropType.uint8]: 0,
  [PropType.uint16]: 0,
  [PropType.uint32]: 0,
  [PropType.json]: null,
  [PropType.jsonFixed]: null,
  [PropType.microBuffer]: undefined,
  [PropType.reference]: undefined,
  [PropType.references]: [],
  [PropType.string]: '',
  [PropType.stringFixed]: '',
  [PropType.aliases]: [],
  [PropType.text]: {},
  [PropType.vector]: undefined, // maybe not can set a vec with 0
  [PropType.colVec]: undefined, // maybe not can set a vec with 0
}

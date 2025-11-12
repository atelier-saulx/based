import { SchemaLocales, SchemaObject, StrictSchemaType } from '../types.js'
import { hashObjectIgnoreKeyOrder } from '@based/hash'

export const createEmptyDef = (
  typeName: string,
  type: StrictSchemaType | SchemaObject,
  locales: Partial<SchemaLocales>,
) => {
  return {
    cnt: 0,
    blockCapacity: 0,
    capped: 0,
    insertOnly: false,
    partial: false,
    checksum: hashObjectIgnoreKeyOrder(type),
    type: typeName,
    props: {},
    reverseProps: {},
    idUint8: new Uint8Array([0, 0]),
    // empty main buffer
    id: 0,
    mainEmpty: new Uint8Array(0),
    mainLen: 0,
    separate: [],
    tree: {},
    total: 0,
    lastId: 0,
    locales: {},
    main: {},
    separateSortProps: 0,
    separateSortText: 0,
    localeSize: 0,
    hasSeperateSort: false,
    separateSort: {
      size: 0,
      props: [],
      buffer: new Uint8Array([]),
      bufferTmp: new Uint8Array([]),
    },
    hasSeperateTextSort: false,
    separateTextSort: {
      size: 0, // prop len
      props: [],
      buffer: new Uint8Array([]),
      noUndefined: new Uint8Array(
        new Array(Object.keys(locales).length).fill(0),
      ),
      bufferTmp: new Uint8Array([]),
      localeStringToIndex: new Map(),
      localeToIndex: new Map(),
    },
  }
}

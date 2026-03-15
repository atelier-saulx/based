import { combineToNumber, readUint32 } from '../../utils/index.js'
import { Item, Meta, ReadMeta, ReadSchema } from './types.js'
import { addMetaProp } from './addProps.js'
import {
  IncludeResponseMeta,
  IncludeResponseMetaByteSize,
  PropType,
  readIncludeResponseMeta,
} from '../../zigTsExports.js'

export const readMeta = (
  q: ReadSchema,
  result: Uint8Array,
  i: number,
  item: Item,
) => {
  const metaResponse: IncludeResponseMeta = readIncludeResponseMeta(
    result,
    i - 1,
  )
  const readProp = q.props[metaResponse.prop]

  if (readProp.meta == ReadMeta.only) {
    readProp.readBy = q.readId
  }
  const meta: Meta = {
    crc32: metaResponse.crc32,
    compressed: metaResponse.compressed,
    size: metaResponse.size,
    checksum: combineToNumber(metaResponse.crc32, metaResponse.size),
    compressedSize: metaResponse.size,
  }
  if (metaResponse.lang !== 0) {
    meta.lang = readProp.locales![metaResponse.lang].name
  }
  i += IncludeResponseMetaByteSize - 1
  if (meta.compressed) {
    meta.compressedSize = readUint32(result, i)
    i += 4
  }

  if (
    readProp.type === PropType.stringLocalized ||
    readProp.type === PropType.jsonLocalized
  ) {
    const lang = readProp.locales![metaResponse.lang]
    if (lang.meta == ReadMeta.only) {
      lang.readBy = q.readId
    }
    addMetaProp(readProp, meta, item, meta.lang, lang.meta)
  } else {
    if (readProp.meta == ReadMeta.only) {
      readProp.readBy = q.readId
    }
    addMetaProp(readProp, meta, item)
  }
  return i
}

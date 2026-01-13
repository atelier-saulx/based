import { 
  writeUint16, writeInt16, 
  writeUint32, writeInt32, 
  writeUint64, writeInt64, 
  writeFloatLE, writeDoubleLE,
  readUint16, readInt16, 
  readUint32, readInt32, 
  readUint64, readInt64, 
  readFloatLE, readDoubleLE
} from './utils/index.js'

export type TypeId = number

export const BridgeResponse = {
  query: 1,
  modify: 2,
  flushQuery: 3,
  flushModify: 4,
} as const

export const BridgeResponseInverse = {
  1: 'query',
  2: 'modify',
  3: 'flushQuery',
  4: 'flushModify',
} as const

/**
  query, 
  modify, 
  flushQuery, 
  flushModify 
 */
export type BridgeResponseEnum = (typeof BridgeResponse)[keyof typeof BridgeResponse]

export const OpType = {
  id: 0,
  ids: 1,
  default: 2,
  alias: 3,
  aggregates: 4,
  aggregatesCount: 5,
  aliasFilter: 8,
  idFilter: 9,
  referenceEdge: 10,
  subscribe: 11,
  unsubscribe: 14,
  blockHash: 42,
  saveBlock: 67,
  saveAllBlocks: 68,
  getSchemaIds: 70,
  modify: 127,
  loadBlock: 128,
  unloadBlock: 129,
  loadCommon: 130,
  createType: 131,
  setSchemaIds: 132,
  emptyMod: 133,
  noOp: 255,
} as const

export const OpTypeInverse = {
  0: 'id',
  1: 'ids',
  2: 'default',
  3: 'alias',
  4: 'aggregates',
  5: 'aggregatesCount',
  8: 'aliasFilter',
  9: 'idFilter',
  10: 'referenceEdge',
  11: 'subscribe',
  14: 'unsubscribe',
  42: 'blockHash',
  67: 'saveBlock',
  68: 'saveAllBlocks',
  70: 'getSchemaIds',
  127: 'modify',
  128: 'loadBlock',
  129: 'unloadBlock',
  130: 'loadCommon',
  131: 'createType',
  132: 'setSchemaIds',
  133: 'emptyMod',
  255: 'noOp',
} as const

/**
  id, 
  ids, 
  default, 
  alias, 
  aggregates, 
  aggregatesCount, 
  aliasFilter, 
  idFilter, 
  referenceEdge, 
  subscribe, 
  unsubscribe, 
  blockHash, 
  saveBlock, 
  saveAllBlocks, 
  getSchemaIds, 
  modify, 
  loadBlock, 
  unloadBlock, 
  loadCommon, 
  createType, 
  setSchemaIds, 
  emptyMod, 
  noOp 
 */
export type OpTypeEnum = (typeof OpType)[keyof typeof OpType]

export const ModOp = {
  switchProp: 0,
  switchIdUpdate: 1,
  switchType: 2,
  createProp: 3,
  deleteSortIndex: 4,
  updatePartial: 5,
  updateProp: 6,
  addEmptySort: 7,
  switchIdCreateUnsafe: 8,
  switchIdCreate: 9,
  switchIdCreateRing: 19,
  deleteNode: 10,
  delete: 11,
  increment: 12,
  decrement: 13,
  expire: 14,
  addEmptySortText: 15,
  deleteTextField: 16,
  upsert: 17,
  insert: 18,
  padding: 255,
} as const

export const ModOpInverse = {
  0: 'switchProp',
  1: 'switchIdUpdate',
  2: 'switchType',
  3: 'createProp',
  4: 'deleteSortIndex',
  5: 'updatePartial',
  6: 'updateProp',
  7: 'addEmptySort',
  8: 'switchIdCreateUnsafe',
  9: 'switchIdCreate',
  19: 'switchIdCreateRing',
  10: 'deleteNode',
  11: 'delete',
  12: 'increment',
  13: 'decrement',
  14: 'expire',
  15: 'addEmptySortText',
  16: 'deleteTextField',
  17: 'upsert',
  18: 'insert',
  255: 'padding',
} as const

/**
  switchProp, 
  switchIdUpdate, 
  switchType, 
  createProp, 
  deleteSortIndex, 
  updatePartial, 
  updateProp, 
  addEmptySort, 
  switchIdCreateUnsafe, 
  switchIdCreate, 
  switchIdCreateRing, 
  deleteNode, 
  delete, 
  increment, 
  decrement, 
  expire, 
  addEmptySortText, 
  deleteTextField, 
  upsert, 
  insert, 
  padding 
 */
export type ModOpEnum = (typeof ModOp)[keyof typeof ModOp]

export const PropType = {
  null: 0,
  timestamp: 1,
  created: 2,
  updated: 3,
  number: 4,
  cardinality: 5,
  uint8: 6,
  uint32: 7,
  boolean: 9,
  enum: 10,
  string: 11,
  text: 12,
  reference: 13,
  references: 14,
  microBuffer: 17,
  alias: 18,
  aliases: 19,
  int8: 20,
  int16: 21,
  uint16: 22,
  int32: 23,
  binary: 25,
  vector: 27,
  json: 28,
  colVec: 30,
  object: 29,
  id: 255,
} as const

export const PropTypeInverse = {
  0: 'null',
  1: 'timestamp',
  2: 'created',
  3: 'updated',
  4: 'number',
  5: 'cardinality',
  6: 'uint8',
  7: 'uint32',
  9: 'boolean',
  10: 'enum',
  11: 'string',
  12: 'text',
  13: 'reference',
  14: 'references',
  17: 'microBuffer',
  18: 'alias',
  19: 'aliases',
  20: 'int8',
  21: 'int16',
  22: 'uint16',
  23: 'int32',
  25: 'binary',
  27: 'vector',
  28: 'json',
  30: 'colVec',
  29: 'object',
  255: 'id',
} as const

/**
  null, 
  timestamp, 
  created, 
  updated, 
  number, 
  cardinality, 
  uint8, 
  uint32, 
  boolean, 
  enum, 
  string, 
  text, 
  reference, 
  references, 
  microBuffer, 
  alias, 
  aliases, 
  int8, 
  int16, 
  uint16, 
  int32, 
  binary, 
  vector, 
  json, 
  colVec, 
  object, 
  id 
 */
export type PropTypeEnum = (typeof PropType)[keyof typeof PropType]

export const RefOp = {
  clear: 0,
  del: 1,
  end: 2,
  set: 3,
  setIndex: 4,
  setTmp: 5,
  setEdge: 6,
  setIndexTmp: 7,
  setEdgeIndex: 8,
  setEdgeIndexTmp: 9,
  setEdgeTmp: 10,
} as const

export const RefOpInverse = {
  0: 'clear',
  1: 'del',
  2: 'end',
  3: 'set',
  4: 'setIndex',
  5: 'setTmp',
  6: 'setEdge',
  7: 'setIndexTmp',
  8: 'setEdgeIndex',
  9: 'setEdgeIndexTmp',
  10: 'setEdgeTmp',
} as const

/**
  clear, 
  del, 
  end, 
  set, 
  setIndex, 
  setTmp, 
  setEdge, 
  setIndexTmp, 
  setEdgeIndex, 
  setEdgeIndexTmp, 
  setEdgeTmp 
 */
export type RefOpEnum = (typeof RefOp)[keyof typeof RefOp]

export const ReadOp = {
  none: 0,
  id: 255,
  edge: 252,
  references: 253,
  reference: 254,
  aggregation: 250,
  meta: 249,
} as const

export const ReadOpInverse = {
  0: 'none',
  255: 'id',
  252: 'edge',
  253: 'references',
  254: 'reference',
  250: 'aggregation',
  249: 'meta',
} as const

/**
  none, 
  id, 
  edge, 
  references, 
  reference, 
  aggregation, 
  meta 
 */
export type ReadOpEnum = (typeof ReadOp)[keyof typeof ReadOp]

export const ReferencesSelect = {
  index: 1,
  any: 2,
  all: 3,
} as const

export const ReferencesSelectInverse = {
  1: 'index',
  2: 'any',
  3: 'all',
} as const

/**
  index, 
  any, 
  all 
 */
export type ReferencesSelectEnum = (typeof ReferencesSelect)[keyof typeof ReferencesSelect]

export const RefEdgeOp = {
  noEdgeNoIndexRealId: 0,
  edgeNoIndexRealId: 1,
  edgeIndexRealId: 2,
  noEdgeIndexRealId: 3,
  noEdgeNoIndexTmpId: 4,
  edgeNoIndexTmpId: 5,
  edgeIndexTmpId: 6,
  noEdgeIndexTmpId: 7,
} as const

export const RefEdgeOpInverse = {
  0: 'noEdgeNoIndexRealId',
  1: 'edgeNoIndexRealId',
  2: 'edgeIndexRealId',
  3: 'noEdgeIndexRealId',
  4: 'noEdgeNoIndexTmpId',
  5: 'edgeNoIndexTmpId',
  6: 'edgeIndexTmpId',
  7: 'noEdgeIndexTmpId',
} as const

/**
  noEdgeNoIndexRealId, 
  edgeNoIndexRealId, 
  edgeIndexRealId, 
  noEdgeIndexRealId, 
  noEdgeNoIndexTmpId, 
  edgeNoIndexTmpId, 
  edgeIndexTmpId, 
  noEdgeIndexTmpId 
 */
// this needs number because it has a any (_) condition
export type RefEdgeOpEnum = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | (number & {})

export const LangCode = {
  none: 0,
  aa: 1,
  ab: 2,
  af: 3,
  ak: 4,
  sq: 5,
  am: 6,
  ar: 7,
  an: 8,
  hy: 9,
  as: 10,
  av: 11,
  ae: 12,
  ay: 13,
  az: 14,
  eu: 15,
  be: 16,
  bn: 17,
  bi: 18,
  bs: 19,
  br: 20,
  bg: 21,
  my: 22,
  ca: 23,
  km: 24,
  ce: 25,
  zh: 26,
  cv: 27,
  kw: 28,
  co: 29,
  hr: 30,
  cs: 31,
  da: 32,
  dv: 33,
  nl: 34,
  dz: 35,
  en: 36,
  et: 37,
  fo: 38,
  fi: 39,
  fr: 40,
  ff: 41,
  gd: 42,
  gl: 43,
  de: 44,
  gsw: 45,
  el: 46,
  kl: 47,
  gu: 48,
  ht: 49,
  ha: 50,
  he: 51,
  hi: 52,
  hu: 53,
  is: 54,
  ig: 55,
  id: 56,
  ia: 57,
  iu: 58,
  ik: 59,
  ga: 60,
  it: 61,
  ja: 62,
  kn: 63,
  ks: 64,
  kk: 65,
  rw: 66,
  ko: 67,
  ku: 68,
  ky: 69,
  lo: 70,
  la: 71,
  lv: 72,
  lb: 73,
  li: 74,
  ln: 75,
  lt: 76,
  mk: 77,
  mg: 78,
  ms: 79,
  ml: 80,
  mt: 81,
  gv: 82,
  mi: 83,
  ro: 84,
  mn: 85,
  ne: 86,
  se: 87,
  no: 88,
  nb: 89,
  nn: 90,
  oc: 91,
  or: 92,
  om: 93,
  os: 94,
  pa: 95,
  ps: 96,
  fa: 97,
  pl: 98,
  pt: 99,
  qu: 100,
  rm: 101,
  ru: 102,
  sm: 103,
  sa: 104,
  sc: 105,
  sr: 106,
  sd: 107,
  si: 108,
  sk: 109,
  sl: 110,
  so: 111,
  st: 112,
  nr: 113,
  es: 114,
  sw: 115,
  ss: 116,
  sv: 117,
  tl: 118,
  tg: 119,
  ta: 120,
  tt: 121,
  te: 122,
  th: 123,
  bo: 124,
  ti: 125,
  to: 126,
  ts: 127,
  tn: 128,
  tr: 129,
  tk: 130,
  ug: 131,
  uk: 132,
  ur: 133,
  uz: 134,
  ve: 135,
  vi: 136,
  wa: 137,
  cy: 138,
  fy: 139,
  wo: 140,
  xh: 141,
  yi: 142,
  yo: 143,
  zu: 144,
  ka: 145,
  cnr: 146,
} as const

export const LangCodeInverse = {
  0: 'none',
  1: 'aa',
  2: 'ab',
  3: 'af',
  4: 'ak',
  5: 'sq',
  6: 'am',
  7: 'ar',
  8: 'an',
  9: 'hy',
  10: 'as',
  11: 'av',
  12: 'ae',
  13: 'ay',
  14: 'az',
  15: 'eu',
  16: 'be',
  17: 'bn',
  18: 'bi',
  19: 'bs',
  20: 'br',
  21: 'bg',
  22: 'my',
  23: 'ca',
  24: 'km',
  25: 'ce',
  26: 'zh',
  27: 'cv',
  28: 'kw',
  29: 'co',
  30: 'hr',
  31: 'cs',
  32: 'da',
  33: 'dv',
  34: 'nl',
  35: 'dz',
  36: 'en',
  37: 'et',
  38: 'fo',
  39: 'fi',
  40: 'fr',
  41: 'ff',
  42: 'gd',
  43: 'gl',
  44: 'de',
  45: 'gsw',
  46: 'el',
  47: 'kl',
  48: 'gu',
  49: 'ht',
  50: 'ha',
  51: 'he',
  52: 'hi',
  53: 'hu',
  54: 'is',
  55: 'ig',
  56: 'id',
  57: 'ia',
  58: 'iu',
  59: 'ik',
  60: 'ga',
  61: 'it',
  62: 'ja',
  63: 'kn',
  64: 'ks',
  65: 'kk',
  66: 'rw',
  67: 'ko',
  68: 'ku',
  69: 'ky',
  70: 'lo',
  71: 'la',
  72: 'lv',
  73: 'lb',
  74: 'li',
  75: 'ln',
  76: 'lt',
  77: 'mk',
  78: 'mg',
  79: 'ms',
  80: 'ml',
  81: 'mt',
  82: 'gv',
  83: 'mi',
  84: 'ro',
  85: 'mn',
  86: 'ne',
  87: 'se',
  88: 'no',
  89: 'nb',
  90: 'nn',
  91: 'oc',
  92: 'or',
  93: 'om',
  94: 'os',
  95: 'pa',
  96: 'ps',
  97: 'fa',
  98: 'pl',
  99: 'pt',
  100: 'qu',
  101: 'rm',
  102: 'ru',
  103: 'sm',
  104: 'sa',
  105: 'sc',
  106: 'sr',
  107: 'sd',
  108: 'si',
  109: 'sk',
  110: 'sl',
  111: 'so',
  112: 'st',
  113: 'nr',
  114: 'es',
  115: 'sw',
  116: 'ss',
  117: 'sv',
  118: 'tl',
  119: 'tg',
  120: 'ta',
  121: 'tt',
  122: 'te',
  123: 'th',
  124: 'bo',
  125: 'ti',
  126: 'to',
  127: 'ts',
  128: 'tn',
  129: 'tr',
  130: 'tk',
  131: 'ug',
  132: 'uk',
  133: 'ur',
  134: 'uz',
  135: 've',
  136: 'vi',
  137: 'wa',
  138: 'cy',
  139: 'fy',
  140: 'wo',
  141: 'xh',
  142: 'yi',
  143: 'yo',
  144: 'zu',
  145: 'ka',
  146: 'cnr',
} as const

/**
  none, 
  aa, 
  ab, 
  af, 
  ak, 
  sq, 
  am, 
  ar, 
  an, 
  hy, 
  as, 
  av, 
  ae, 
  ay, 
  az, 
  eu, 
  be, 
  bn, 
  bi, 
  bs, 
  br, 
  bg, 
  my, 
  ca, 
  km, 
  ce, 
  zh, 
  cv, 
  kw, 
  co, 
  hr, 
  cs, 
  da, 
  dv, 
  nl, 
  dz, 
  en, 
  et, 
  fo, 
  fi, 
  fr, 
  ff, 
  gd, 
  gl, 
  de, 
  gsw, 
  el, 
  kl, 
  gu, 
  ht, 
  ha, 
  he, 
  hi, 
  hu, 
  is, 
  ig, 
  id, 
  ia, 
  iu, 
  ik, 
  ga, 
  it, 
  ja, 
  kn, 
  ks, 
  kk, 
  rw, 
  ko, 
  ku, 
  ky, 
  lo, 
  la, 
  lv, 
  lb, 
  li, 
  ln, 
  lt, 
  mk, 
  mg, 
  ms, 
  ml, 
  mt, 
  gv, 
  mi, 
  ro, 
  mn, 
  ne, 
  se, 
  no, 
  nb, 
  nn, 
  oc, 
  or, 
  om, 
  os, 
  pa, 
  ps, 
  fa, 
  pl, 
  pt, 
  qu, 
  rm, 
  ru, 
  sm, 
  sa, 
  sc, 
  sr, 
  sd, 
  si, 
  sk, 
  sl, 
  so, 
  st, 
  nr, 
  es, 
  sw, 
  ss, 
  sv, 
  tl, 
  tg, 
  ta, 
  tt, 
  te, 
  th, 
  bo, 
  ti, 
  to, 
  ts, 
  tn, 
  tr, 
  tk, 
  ug, 
  uk, 
  ur, 
  uz, 
  ve, 
  vi, 
  wa, 
  cy, 
  fy, 
  wo, 
  xh, 
  yi, 
  yo, 
  zu, 
  ka, 
  cnr 
 */
export type LangCodeEnum = (typeof LangCode)[keyof typeof LangCode]

export const MAIN_PROP = 0
export const ID_PROP = 255

export const ResultType = {
  default: 0,
  references: 1,
  reference: 2,
  edge: 3,
  referencesEdge: 4,
  referenceEdge: 5,
  aggregate: 6,
  meta: 7,
  metaEdge: 8,
  fixed: 9,
  edgeFixed: 10,
} as const

export const ResultTypeInverse = {
  0: 'default',
  1: 'references',
  2: 'reference',
  3: 'edge',
  4: 'referencesEdge',
  5: 'referenceEdge',
  6: 'aggregate',
  7: 'meta',
  8: 'metaEdge',
  9: 'fixed',
  10: 'edgeFixed',
} as const

/**
  default, 
  references, 
  reference, 
  edge, 
  referencesEdge, 
  referenceEdge, 
  aggregate, 
  meta, 
  metaEdge, 
  fixed, 
  edgeFixed 
 */
export type ResultTypeEnum = (typeof ResultType)[keyof typeof ResultType]

export const AggFunction = {
  none: 0,
  avg: 1,
  cardinality: 2,
  concat: 3,
  count: 4,
  max: 5,
  min: 6,
  mode: 7,
  percentile: 8,
  rank: 9,
  stddev: 10,
  sum: 11,
  variance: 12,
  hmean: 13,
} as const

export const AggFunctionInverse = {
  0: 'none',
  1: 'avg',
  2: 'cardinality',
  3: 'concat',
  4: 'count',
  5: 'max',
  6: 'min',
  7: 'mode',
  8: 'percentile',
  9: 'rank',
  10: 'stddev',
  11: 'sum',
  12: 'variance',
  13: 'hmean',
} as const

/**
  none, 
  avg, 
  cardinality, 
  concat, 
  count, 
  max, 
  min, 
  mode, 
  percentile, 
  rank, 
  stddev, 
  sum, 
  variance, 
  hmean 
 */
export type AggFunctionEnum = (typeof AggFunction)[keyof typeof AggFunction]

export const Compression = {
  none: 0,
  compressed: 1,
} as const

export const CompressionInverse = {
  0: 'none',
  1: 'compressed',
} as const

/**
  none, 
  compressed 
 */
export type CompressionEnum = (typeof Compression)[keyof typeof Compression]

export const Interval = {
  none: 0,
  epoch: 1,
  hour: 2,
  minute: 3,
  second: 4,
  microseconds: 5,
  day: 6,
  doy: 7,
  dow: 8,
  isoDOW: 9,
  week: 10,
  month: 11,
  isoMonth: 12,
  quarter: 13,
  year: 14,
} as const

export const IntervalInverse = {
  0: 'none',
  1: 'epoch',
  2: 'hour',
  3: 'minute',
  4: 'second',
  5: 'microseconds',
  6: 'day',
  7: 'doy',
  8: 'dow',
  9: 'isoDOW',
  10: 'week',
  11: 'month',
  12: 'isoMonth',
  13: 'quarter',
  14: 'year',
} as const

/**
  none, 
  epoch, 
  hour, 
  minute, 
  second, 
  microseconds, 
  day, 
  doy, 
  dow, 
  isoDOW, 
  week, 
  month, 
  isoMonth, 
  quarter, 
  year 
 */
export type IntervalEnum = (typeof Interval)[keyof typeof Interval]

export const Order = {
  asc: 0,
  desc: 1,
} as const

export const OrderInverse = {
  0: 'asc',
  1: 'desc',
} as const

/**
  asc, 
  desc 
 */
export type OrderEnum = (typeof Order)[keyof typeof Order]

export type SortHeader = {
  order: OrderEnum
  prop: number
  propType: PropTypeEnum
  start: number
  len: number
  lang: LangCodeEnum
  edgeType: number
}

export const SortHeaderByteSize = 10

export const writeSortHeader = (
  buf: Uint8Array,
  header: SortHeader,
  offset: number,
): number => {
  buf[offset] = header.order
  offset += 1
  buf[offset] = header.prop
  offset += 1
  buf[offset] = header.propType
  offset += 1
  writeUint16(buf, header.start, offset)
  offset += 2
  writeUint16(buf, header.len, offset)
  offset += 2
  buf[offset] = header.lang
  offset += 1
  writeUint16(buf, header.edgeType, offset)
  offset += 2
  return offset
}

export const writeSortHeaderProps = {
  order: (buf: Uint8Array, value: OrderEnum, offset: number) => {
    buf[offset] = value
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = value
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = value
  },
  start: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 3)
  },
  len: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 5)
  },
  lang: (buf: Uint8Array, value: LangCodeEnum, offset: number) => {
    buf[offset + 7] = value
  },
  edgeType: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 8)
  },
}

export const readSortHeader = (
  buf: Uint8Array,
  offset: number,
): SortHeader => {
  const value: SortHeader = {
    order: (buf[offset]) as OrderEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
    start: readUint16(buf, offset + 3),
    len: readUint16(buf, offset + 5),
    lang: (buf[offset + 7]) as LangCodeEnum,
    edgeType: readUint16(buf, offset + 8),
  }
  return value
}

export const readSortHeaderProps = {
  order: (buf: Uint8Array, offset: number): OrderEnum => {
    return (buf[offset]) as OrderEnum
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 1]
  },
  propType: (buf: Uint8Array, offset: number): PropTypeEnum => {
    return (buf[offset + 2]) as PropTypeEnum
  },
  start: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 3)
  },
  len: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 5)
  },
  lang: (buf: Uint8Array, offset: number): LangCodeEnum => {
    return (buf[offset + 7]) as LangCodeEnum
  },
  edgeType: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 8)
  },
}

export const createSortHeader = (header: SortHeader): Uint8Array => {
  const buffer = new Uint8Array(SortHeaderByteSize)
  writeSortHeader(buffer, header, 0)
  return buffer
}

export const QUERY_ITERATOR_DEFAULT = 0
export const QUERY_ITERATOR_EDGE = 20
export const QUERY_ITERATOR_EDGE_INCLUDE = 30
export const QUERY_ITERATOR_SEARCH = 120
export const QUERY_ITERATOR_SEARCH_VEC = 130
export const QueryIteratorType = {
  default: 0,
  sort: 1,
  filter: 2,
  filterSort: 3,
  desc: 4,
  descSort: 5,
  descFilter: 6,
  descFilterSort: 7,
  edge: 20,
  edgeSort: 21,
  edgeFilter: 22,
  edgeFilterSort: 23,
  edgeDesc: 24,
  edgeDescSort: 25,
  edgeDescFilter: 26,
  edgeDescFilterSort: 27,
  edgeInclude: 30,
  edgeIncludeSort: 31,
  edgeIncludeFilter: 32,
  edgeIncludeFilterSort: 33,
  edgeIncludeDesc: 34,
  edgeIncludeDescSort: 35,
  edgeIncludeDescFilter: 36,
  edgeIncludeDescFilterSort: 37,
  search: 120,
  searchFilter: 121,
  vec: 130,
  vecFilter: 131,
} as const

export const QueryIteratorTypeInverse = {
  0: 'default',
  1: 'sort',
  2: 'filter',
  3: 'filterSort',
  4: 'desc',
  5: 'descSort',
  6: 'descFilter',
  7: 'descFilterSort',
  20: 'edge',
  21: 'edgeSort',
  22: 'edgeFilter',
  23: 'edgeFilterSort',
  24: 'edgeDesc',
  25: 'edgeDescSort',
  26: 'edgeDescFilter',
  27: 'edgeDescFilterSort',
  30: 'edgeInclude',
  31: 'edgeIncludeSort',
  32: 'edgeIncludeFilter',
  33: 'edgeIncludeFilterSort',
  34: 'edgeIncludeDesc',
  35: 'edgeIncludeDescSort',
  36: 'edgeIncludeDescFilter',
  37: 'edgeIncludeDescFilterSort',
  120: 'search',
  121: 'searchFilter',
  130: 'vec',
  131: 'vecFilter',
} as const

/**
  default, 
  sort, 
  filter, 
  filterSort, 
  desc, 
  descSort, 
  descFilter, 
  descFilterSort, 
  edge, 
  edgeSort, 
  edgeFilter, 
  edgeFilterSort, 
  edgeDesc, 
  edgeDescSort, 
  edgeDescFilter, 
  edgeDescFilterSort, 
  edgeInclude, 
  edgeIncludeSort, 
  edgeIncludeFilter, 
  edgeIncludeFilterSort, 
  edgeIncludeDesc, 
  edgeIncludeDescSort, 
  edgeIncludeDescFilter, 
  edgeIncludeDescFilterSort, 
  search, 
  searchFilter, 
  vec, 
  vecFilter 
 */
export type QueryIteratorTypeEnum = (typeof QueryIteratorType)[keyof typeof QueryIteratorType]

export const QueryType = {
  id: 0,
  ids: 1,
  default: 2,
  alias: 3,
  aggregates: 4,
  aggregatesCount: 5,
  references: 6,
  reference: 7,
  aliasFilter: 8,
  idFilter: 9,
  referenceEdge: 10,
} as const

export const QueryTypeInverse = {
  0: 'id',
  1: 'ids',
  2: 'default',
  3: 'alias',
  4: 'aggregates',
  5: 'aggregatesCount',
  6: 'references',
  7: 'reference',
  8: 'aliasFilter',
  9: 'idFilter',
  10: 'referenceEdge',
} as const

/**
  id, 
  ids, 
  default, 
  alias, 
  aggregates, 
  aggregatesCount, 
  references, 
  reference, 
  aliasFilter, 
  idFilter, 
  referenceEdge 
 */
export type QueryTypeEnum = (typeof QueryType)[keyof typeof QueryType]

export const IncludeOp = {
  aggregates: 4,
  aggregatesCount: 5,
  references: 6,
  reference: 7,
  referenceEdge: 10,
  default: 127,
  referencesAggregation: 128,
  meta: 129,
  partial: 130,
  defaultWithOpts: 131,
  metaWithOpts: 132,
} as const

export const IncludeOpInverse = {
  4: 'aggregates',
  5: 'aggregatesCount',
  6: 'references',
  7: 'reference',
  10: 'referenceEdge',
  127: 'default',
  128: 'referencesAggregation',
  129: 'meta',
  130: 'partial',
  131: 'defaultWithOpts',
  132: 'metaWithOpts',
} as const

/**
  aggregates, 
  aggregatesCount, 
  references, 
  reference, 
  referenceEdge, 
  default, 
  referencesAggregation, 
  meta, 
  partial, 
  defaultWithOpts, 
  metaWithOpts 
 */
export type IncludeOpEnum = (typeof IncludeOp)[keyof typeof IncludeOp]

export type IncludeHeader = {
  op: IncludeOpEnum
  prop: number
  propType: PropTypeEnum
}

export const IncludeHeaderByteSize = 3

export const writeIncludeHeader = (
  buf: Uint8Array,
  header: IncludeHeader,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  buf[offset] = header.prop
  offset += 1
  buf[offset] = header.propType
  offset += 1
  return offset
}

export const writeIncludeHeaderProps = {
  op: (buf: Uint8Array, value: IncludeOpEnum, offset: number) => {
    buf[offset] = value
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = value
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = value
  },
}

export const readIncludeHeader = (
  buf: Uint8Array,
  offset: number,
): IncludeHeader => {
  const value: IncludeHeader = {
    op: (buf[offset]) as IncludeOpEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
  }
  return value
}

export const readIncludeHeaderProps = {
  op: (buf: Uint8Array, offset: number): IncludeOpEnum => {
    return (buf[offset]) as IncludeOpEnum
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 1]
  },
  propType: (buf: Uint8Array, offset: number): PropTypeEnum => {
    return (buf[offset + 2]) as PropTypeEnum
  },
}

export const createIncludeHeader = (header: IncludeHeader): Uint8Array => {
  const buffer = new Uint8Array(IncludeHeaderByteSize)
  writeIncludeHeader(buffer, header, 0)
  return buffer
}

export type IncludeMetaHeader = {
  op: IncludeOpEnum
  prop: number
  propType: PropTypeEnum
}

export const IncludeMetaHeaderByteSize = 3

export const writeIncludeMetaHeader = (
  buf: Uint8Array,
  header: IncludeMetaHeader,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  buf[offset] = header.prop
  offset += 1
  buf[offset] = header.propType
  offset += 1
  return offset
}

export const writeIncludeMetaHeaderProps = {
  op: (buf: Uint8Array, value: IncludeOpEnum, offset: number) => {
    buf[offset] = value
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = value
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = value
  },
}

export const readIncludeMetaHeader = (
  buf: Uint8Array,
  offset: number,
): IncludeMetaHeader => {
  const value: IncludeMetaHeader = {
    op: (buf[offset]) as IncludeOpEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
  }
  return value
}

export const readIncludeMetaHeaderProps = {
  op: (buf: Uint8Array, offset: number): IncludeOpEnum => {
    return (buf[offset]) as IncludeOpEnum
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 1]
  },
  propType: (buf: Uint8Array, offset: number): PropTypeEnum => {
    return (buf[offset + 2]) as PropTypeEnum
  },
}

export const createIncludeMetaHeader = (header: IncludeMetaHeader): Uint8Array => {
  const buffer = new Uint8Array(IncludeMetaHeaderByteSize)
  writeIncludeMetaHeader(buffer, header, 0)
  return buffer
}

export type IncludePartialHeader = {
  op: IncludeOpEnum
  prop: number
  propType: PropTypeEnum
  amount: number
}

export const IncludePartialHeaderByteSize = 5

export const writeIncludePartialHeader = (
  buf: Uint8Array,
  header: IncludePartialHeader,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  buf[offset] = header.prop
  offset += 1
  buf[offset] = header.propType
  offset += 1
  writeUint16(buf, header.amount, offset)
  offset += 2
  return offset
}

export const writeIncludePartialHeaderProps = {
  op: (buf: Uint8Array, value: IncludeOpEnum, offset: number) => {
    buf[offset] = value
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = value
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = value
  },
  amount: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 3)
  },
}

export const readIncludePartialHeader = (
  buf: Uint8Array,
  offset: number,
): IncludePartialHeader => {
  const value: IncludePartialHeader = {
    op: (buf[offset]) as IncludeOpEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
    amount: readUint16(buf, offset + 3),
  }
  return value
}

export const readIncludePartialHeaderProps = {
  op: (buf: Uint8Array, offset: number): IncludeOpEnum => {
    return (buf[offset]) as IncludeOpEnum
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 1]
  },
  propType: (buf: Uint8Array, offset: number): PropTypeEnum => {
    return (buf[offset + 2]) as PropTypeEnum
  },
  amount: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 3)
  },
}

export const createIncludePartialHeader = (header: IncludePartialHeader): Uint8Array => {
  const buffer = new Uint8Array(IncludePartialHeaderByteSize)
  writeIncludePartialHeader(buffer, header, 0)
  return buffer
}

export type IncludePartialProp = {
  start: number
  size: number
}

export const IncludePartialPropByteSize = 4

export const writeIncludePartialProp = (
  buf: Uint8Array,
  header: IncludePartialProp,
  offset: number,
): number => {
  writeUint16(buf, header.start, offset)
  offset += 2
  writeUint16(buf, header.size, offset)
  offset += 2
  return offset
}

export const writeIncludePartialPropProps = {
  start: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 2)
  },
}

export const readIncludePartialProp = (
  buf: Uint8Array,
  offset: number,
): IncludePartialProp => {
  const value: IncludePartialProp = {
    start: readUint16(buf, offset),
    size: readUint16(buf, offset + 2),
  }
  return value
}

export const readIncludePartialPropProps = {
  start: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset)
  },
  size: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 2)
  },
}

export const createIncludePartialProp = (header: IncludePartialProp): Uint8Array => {
  const buffer = new Uint8Array(IncludePartialPropByteSize)
  writeIncludePartialProp(buffer, header, 0)
  return buffer
}

export type IncludeOpts = {
  end: number
  isChars: boolean
  hasOpts: boolean
  langFallbackSize: number
  lang: LangCodeEnum
}

export const IncludeOptsByteSize = 7

export const writeIncludeOpts = (
  buf: Uint8Array,
  header: IncludeOpts,
  offset: number,
): number => {
  writeUint32(buf, header.end, offset)
  offset += 4
  buf[offset] = 0
  buf[offset] |= (((header.isChars ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= (((header.hasOpts ? 1 : 0) >>> 0) & 1) << 1
  buf[offset] |= ((0 >>> 0) & 63) << 2
  offset += 1
  buf[offset] = header.langFallbackSize
  offset += 1
  buf[offset] = header.lang
  offset += 1
  return offset
}

export const writeIncludeOptsProps = {
  end: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset)
  },
  isChars: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 4] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  hasOpts: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 4] |= (((value ? 1 : 0) >>> 0) & 1) << 1
  },
  langFallbackSize: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 5] = value
  },
  lang: (buf: Uint8Array, value: LangCodeEnum, offset: number) => {
    buf[offset + 6] = value
  },
}

export const readIncludeOpts = (
  buf: Uint8Array,
  offset: number,
): IncludeOpts => {
  const value: IncludeOpts = {
    end: readUint32(buf, offset),
    isChars: (((buf[offset + 4] >>> 0) & 1)) === 1,
    hasOpts: (((buf[offset + 4] >>> 1) & 1)) === 1,
    langFallbackSize: buf[offset + 5],
    lang: (buf[offset + 6]) as LangCodeEnum,
  }
  return value
}

export const readIncludeOptsProps = {
  end: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset)
  },
  isChars: (buf: Uint8Array, offset: number): boolean => {
    return (((buf[offset + 4] >>> 0) & 1)) === 1
  },
  hasOpts: (buf: Uint8Array, offset: number): boolean => {
    return (((buf[offset + 4] >>> 1) & 1)) === 1
  },
  langFallbackSize: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 5]
  },
  lang: (buf: Uint8Array, offset: number): LangCodeEnum => {
    return (buf[offset + 6]) as LangCodeEnum
  },
}

export const createIncludeOpts = (header: IncludeOpts): Uint8Array => {
  const buffer = new Uint8Array(IncludeOptsByteSize)
  writeIncludeOpts(buffer, header, 0)
  return buffer
}

export type IncludeResponse = {
  prop: number
  size: number
}

export const IncludeResponseByteSize = 5

export const writeIncludeResponse = (
  buf: Uint8Array,
  header: IncludeResponse,
  offset: number,
): number => {
  buf[offset] = header.prop
  offset += 1
  writeUint32(buf, header.size, offset)
  offset += 4
  return offset
}

export const writeIncludeResponseProps = {
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset] = value
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 1)
  },
}

export const readIncludeResponse = (
  buf: Uint8Array,
  offset: number,
): IncludeResponse => {
  const value: IncludeResponse = {
    prop: buf[offset],
    size: readUint32(buf, offset + 1),
  }
  return value
}

export const readIncludeResponseProps = {
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset]
  },
  size: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 1)
  },
}

export const createIncludeResponse = (header: IncludeResponse): Uint8Array => {
  const buffer = new Uint8Array(IncludeResponseByteSize)
  writeIncludeResponse(buffer, header, 0)
  return buffer
}

export type IncludeResponseMeta = {
  op: ReadOpEnum
  prop: number
  lang: LangCodeEnum
  compressed: boolean
  crc32: number
  size: number
}

export const IncludeResponseMetaByteSize = 12

export const writeIncludeResponseMeta = (
  buf: Uint8Array,
  header: IncludeResponseMeta,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  buf[offset] = header.prop
  offset += 1
  buf[offset] = header.lang
  offset += 1
  buf[offset] = 0
  buf[offset] |= (((header.compressed ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= ((0 >>> 0) & 127) << 1
  offset += 1
  writeUint32(buf, header.crc32, offset)
  offset += 4
  writeUint32(buf, header.size, offset)
  offset += 4
  return offset
}

export const writeIncludeResponseMetaProps = {
  op: (buf: Uint8Array, value: ReadOpEnum, offset: number) => {
    buf[offset] = value
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = value
  },
  lang: (buf: Uint8Array, value: LangCodeEnum, offset: number) => {
    buf[offset + 2] = value
  },
  compressed: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 3] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  crc32: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 4)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 8)
  },
}

export const readIncludeResponseMeta = (
  buf: Uint8Array,
  offset: number,
): IncludeResponseMeta => {
  const value: IncludeResponseMeta = {
    op: (buf[offset]) as ReadOpEnum,
    prop: buf[offset + 1],
    lang: (buf[offset + 2]) as LangCodeEnum,
    compressed: (((buf[offset + 3] >>> 0) & 1)) === 1,
    crc32: readUint32(buf, offset + 4),
    size: readUint32(buf, offset + 8),
  }
  return value
}

export const readIncludeResponseMetaProps = {
  op: (buf: Uint8Array, offset: number): ReadOpEnum => {
    return (buf[offset]) as ReadOpEnum
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 1]
  },
  lang: (buf: Uint8Array, offset: number): LangCodeEnum => {
    return (buf[offset + 2]) as LangCodeEnum
  },
  compressed: (buf: Uint8Array, offset: number): boolean => {
    return (((buf[offset + 3] >>> 0) & 1)) === 1
  },
  crc32: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 4)
  },
  size: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 8)
  },
}

export const createIncludeResponseMeta = (header: IncludeResponseMeta): Uint8Array => {
  const buffer = new Uint8Array(IncludeResponseMetaByteSize)
  writeIncludeResponseMeta(buffer, header, 0)
  return buffer
}

export type SubscriptionHeader = {
  op: OpTypeEnum
  typeId: TypeId
  fieldsLen: number
  partialLen: number
}

export const SubscriptionHeaderByteSize = 5

export const writeSubscriptionHeader = (
  buf: Uint8Array,
  header: SubscriptionHeader,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  writeUint16(buf, header.typeId, offset)
  offset += 2
  buf[offset] = header.fieldsLen
  offset += 1
  buf[offset] = header.partialLen
  offset += 1
  return offset
}

export const writeSubscriptionHeaderProps = {
  op: (buf: Uint8Array, value: OpTypeEnum, offset: number) => {
    buf[offset] = value
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset + 1)
  },
  fieldsLen: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 3] = value
  },
  partialLen: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 4] = value
  },
}

export const readSubscriptionHeader = (
  buf: Uint8Array,
  offset: number,
): SubscriptionHeader => {
  const value: SubscriptionHeader = {
    op: (buf[offset]) as OpTypeEnum,
    typeId: (readUint16(buf, offset + 1)) as TypeId,
    fieldsLen: buf[offset + 3],
    partialLen: buf[offset + 4],
  }
  return value
}

export const readSubscriptionHeaderProps = {
  op: (buf: Uint8Array, offset: number): OpTypeEnum => {
    return (buf[offset]) as OpTypeEnum
  },
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset + 1)) as TypeId
  },
  fieldsLen: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 3]
  },
  partialLen: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 4]
  },
}

export const createSubscriptionHeader = (header: SubscriptionHeader): Uint8Array => {
  const buffer = new Uint8Array(SubscriptionHeaderByteSize)
  writeSubscriptionHeader(buffer, header, 0)
  return buffer
}

export type QueryHeader = {
  op: QueryTypeEnum
  prop: number
  typeId: TypeId
  edgeTypeId: TypeId
  offset: number
  limit: number
  filterSize: number
  searchSize: number
  edgeSize: number
  edgeFilterSize: number
  includeSize: number
  iteratorType: QueryIteratorTypeEnum
  size: number
  sort: boolean
}

export const QueryHeaderByteSize = 28

export const writeQueryHeader = (
  buf: Uint8Array,
  header: QueryHeader,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  buf[offset] = header.prop
  offset += 1
  writeUint16(buf, header.typeId, offset)
  offset += 2
  writeUint16(buf, header.edgeTypeId, offset)
  offset += 2
  writeUint32(buf, header.offset, offset)
  offset += 4
  writeUint32(buf, header.limit, offset)
  offset += 4
  writeUint16(buf, header.filterSize, offset)
  offset += 2
  writeUint16(buf, header.searchSize, offset)
  offset += 2
  writeUint16(buf, header.edgeSize, offset)
  offset += 2
  writeUint16(buf, header.edgeFilterSize, offset)
  offset += 2
  writeUint16(buf, header.includeSize, offset)
  offset += 2
  buf[offset] = header.iteratorType
  offset += 1
  writeUint16(buf, header.size, offset)
  offset += 2
  buf[offset] = 0
  buf[offset] |= (((header.sort ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= ((0 >>> 0) & 127) << 1
  offset += 1
  return offset
}

export const writeQueryHeaderProps = {
  op: (buf: Uint8Array, value: QueryTypeEnum, offset: number) => {
    buf[offset] = value
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = value
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset + 2)
  },
  edgeTypeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset + 4)
  },
  offset: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 6)
  },
  limit: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 10)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 14)
  },
  searchSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 16)
  },
  edgeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 18)
  },
  edgeFilterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 20)
  },
  includeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 22)
  },
  iteratorType: (buf: Uint8Array, value: QueryIteratorTypeEnum, offset: number) => {
    buf[offset + 24] = value
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 25)
  },
  sort: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 27] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
}

export const readQueryHeader = (
  buf: Uint8Array,
  offset: number,
): QueryHeader => {
  const value: QueryHeader = {
    op: (buf[offset]) as QueryTypeEnum,
    prop: buf[offset + 1],
    typeId: (readUint16(buf, offset + 2)) as TypeId,
    edgeTypeId: (readUint16(buf, offset + 4)) as TypeId,
    offset: readUint32(buf, offset + 6),
    limit: readUint32(buf, offset + 10),
    filterSize: readUint16(buf, offset + 14),
    searchSize: readUint16(buf, offset + 16),
    edgeSize: readUint16(buf, offset + 18),
    edgeFilterSize: readUint16(buf, offset + 20),
    includeSize: readUint16(buf, offset + 22),
    iteratorType: (buf[offset + 24]) as QueryIteratorTypeEnum,
    size: readUint16(buf, offset + 25),
    sort: (((buf[offset + 27] >>> 0) & 1)) === 1,
  }
  return value
}

export const readQueryHeaderProps = {
  op: (buf: Uint8Array, offset: number): QueryTypeEnum => {
    return (buf[offset]) as QueryTypeEnum
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 1]
  },
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset + 2)) as TypeId
  },
  edgeTypeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset + 4)) as TypeId
  },
  offset: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 6)
  },
  limit: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 10)
  },
  filterSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 14)
  },
  searchSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 16)
  },
  edgeSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 18)
  },
  edgeFilterSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 20)
  },
  includeSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 22)
  },
  iteratorType: (buf: Uint8Array, offset: number): QueryIteratorTypeEnum => {
    return (buf[offset + 24]) as QueryIteratorTypeEnum
  },
  size: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 25)
  },
  sort: (buf: Uint8Array, offset: number): boolean => {
    return (((buf[offset + 27] >>> 0) & 1)) === 1
  },
}

export const createQueryHeader = (header: QueryHeader): Uint8Array => {
  const buffer = new Uint8Array(QueryHeaderByteSize)
  writeQueryHeader(buffer, header, 0)
  return buffer
}

export type QueryHeaderSingle = {
  op: QueryTypeEnum
  typeId: TypeId
  prop: number
  id: number
  filterSize: number
  includeSize: number
  aliasSize: number
}

export const QueryHeaderSingleByteSize = 14

export const writeQueryHeaderSingle = (
  buf: Uint8Array,
  header: QueryHeaderSingle,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  writeUint16(buf, header.typeId, offset)
  offset += 2
  buf[offset] = header.prop
  offset += 1
  writeUint32(buf, header.id, offset)
  offset += 4
  writeUint16(buf, header.filterSize, offset)
  offset += 2
  writeUint16(buf, header.includeSize, offset)
  offset += 2
  writeUint16(buf, header.aliasSize, offset)
  offset += 2
  return offset
}

export const writeQueryHeaderSingleProps = {
  op: (buf: Uint8Array, value: QueryTypeEnum, offset: number) => {
    buf[offset] = value
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset + 1)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 3] = value
  },
  id: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 4)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 8)
  },
  includeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 10)
  },
  aliasSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 12)
  },
}

export const readQueryHeaderSingle = (
  buf: Uint8Array,
  offset: number,
): QueryHeaderSingle => {
  const value: QueryHeaderSingle = {
    op: (buf[offset]) as QueryTypeEnum,
    typeId: (readUint16(buf, offset + 1)) as TypeId,
    prop: buf[offset + 3],
    id: readUint32(buf, offset + 4),
    filterSize: readUint16(buf, offset + 8),
    includeSize: readUint16(buf, offset + 10),
    aliasSize: readUint16(buf, offset + 12),
  }
  return value
}

export const readQueryHeaderSingleProps = {
  op: (buf: Uint8Array, offset: number): QueryTypeEnum => {
    return (buf[offset]) as QueryTypeEnum
  },
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset + 1)) as TypeId
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 3]
  },
  id: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 4)
  },
  filterSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 8)
  },
  includeSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 10)
  },
  aliasSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 12)
  },
}

export const createQueryHeaderSingle = (header: QueryHeaderSingle): Uint8Array => {
  const buffer = new Uint8Array(QueryHeaderSingleByteSize)
  writeQueryHeaderSingle(buffer, header, 0)
  return buffer
}

export type QueryHeaderSingleReference = {
  op: QueryTypeEnum
  prop: number
  typeId: TypeId
  edgeTypeId: TypeId
  edgeSize: number
  includeSize: number
}

export const QueryHeaderSingleReferenceByteSize = 10

export const writeQueryHeaderSingleReference = (
  buf: Uint8Array,
  header: QueryHeaderSingleReference,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  buf[offset] = header.prop
  offset += 1
  writeUint16(buf, header.typeId, offset)
  offset += 2
  writeUint16(buf, header.edgeTypeId, offset)
  offset += 2
  writeUint16(buf, header.edgeSize, offset)
  offset += 2
  writeUint16(buf, header.includeSize, offset)
  offset += 2
  return offset
}

export const writeQueryHeaderSingleReferenceProps = {
  op: (buf: Uint8Array, value: QueryTypeEnum, offset: number) => {
    buf[offset] = value
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = value
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset + 2)
  },
  edgeTypeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset + 4)
  },
  edgeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 6)
  },
  includeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 8)
  },
}

export const readQueryHeaderSingleReference = (
  buf: Uint8Array,
  offset: number,
): QueryHeaderSingleReference => {
  const value: QueryHeaderSingleReference = {
    op: (buf[offset]) as QueryTypeEnum,
    prop: buf[offset + 1],
    typeId: (readUint16(buf, offset + 2)) as TypeId,
    edgeTypeId: (readUint16(buf, offset + 4)) as TypeId,
    edgeSize: readUint16(buf, offset + 6),
    includeSize: readUint16(buf, offset + 8),
  }
  return value
}

export const readQueryHeaderSingleReferenceProps = {
  op: (buf: Uint8Array, offset: number): QueryTypeEnum => {
    return (buf[offset]) as QueryTypeEnum
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 1]
  },
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset + 2)) as TypeId
  },
  edgeTypeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset + 4)) as TypeId
  },
  edgeSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 6)
  },
  includeSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 8)
  },
}

export const createQueryHeaderSingleReference = (header: QueryHeaderSingleReference): Uint8Array => {
  const buffer = new Uint8Array(QueryHeaderSingleReferenceByteSize)
  writeQueryHeaderSingleReference(buffer, header, 0)
  return buffer
}

export const FilterOp = {
  equal: 1,
  has: 2,
  endsWith: 4,
  startsWith: 5,
  largerThen: 6,
  smallerThen: 7,
  largerThenInclusive: 8,
  smallerThenInclusive: 9,
  equalNormalize: 12,
  hasLowerCase: 13,
  startsWithNormalize: 14,
  endsWithNormalize: 15,
  equalCrc32: 17,
  like: 18,
} as const

export const FilterOpInverse = {
  1: 'equal',
  2: 'has',
  4: 'endsWith',
  5: 'startsWith',
  6: 'largerThen',
  7: 'smallerThen',
  8: 'largerThenInclusive',
  9: 'smallerThenInclusive',
  12: 'equalNormalize',
  13: 'hasLowerCase',
  14: 'startsWithNormalize',
  15: 'endsWithNormalize',
  17: 'equalCrc32',
  18: 'like',
} as const

/**
  equal, 
  has, 
  endsWith, 
  startsWith, 
  largerThen, 
  smallerThen, 
  largerThenInclusive, 
  smallerThenInclusive, 
  equalNormalize, 
  hasLowerCase, 
  startsWithNormalize, 
  endsWithNormalize, 
  equalCrc32, 
  like 
 */
export type FilterOpEnum = (typeof FilterOp)[keyof typeof FilterOp]

export const FilterType = {
  negate: 1,
  default: 2,
} as const

export const FilterTypeInverse = {
  1: 'negate',
  2: 'default',
} as const

/**
  negate, 
  default 
 */
export type FilterTypeEnum = (typeof FilterType)[keyof typeof FilterType]

export const FilterMode = {
  default: 0,
  orFixed: 1,
  orVar: 2,
  andFixed: 3,
  defaultVar: 4,
  reference: 5,
} as const

export const FilterModeInverse = {
  0: 'default',
  1: 'orFixed',
  2: 'orVar',
  3: 'andFixed',
  4: 'defaultVar',
  5: 'reference',
} as const

/**
  default, 
  orFixed, 
  orVar, 
  andFixed, 
  defaultVar, 
  reference 
 */
export type FilterModeEnum = (typeof FilterMode)[keyof typeof FilterMode]

export const FilterMeta = {
  references: 250,
  exists: 251,
  edge: 252,
  orBranch: 253,
  reference: 254,
  id: 255,
} as const

export const FilterMetaInverse = {
  250: 'references',
  251: 'exists',
  252: 'edge',
  253: 'orBranch',
  254: 'reference',
  255: 'id',
} as const

/**
  references, 
  exists, 
  edge, 
  orBranch, 
  reference, 
  id 
 */
// this needs number because it has a any (_) condition
export type FilterMetaEnum = 250 | 251 | 252 | 253 | 254 | 255 | (number & {})

export const FilterVectorFn = {
  dotProduct: 0,
  manhattanDistance: 1,
  cosineSimilarity: 2,
  euclideanDistance: 3,
} as const

export const FilterVectorFnInverse = {
  0: 'dotProduct',
  1: 'manhattanDistance',
  2: 'cosineSimilarity',
  3: 'euclideanDistance',
} as const

/**
  dotProduct, 
  manhattanDistance, 
  cosineSimilarity, 
  euclideanDistance 
 */
export type FilterVectorFnEnum = (typeof FilterVectorFn)[keyof typeof FilterVectorFn]

export const VectorBaseType = {
  int8: 1,
  uint8: 2,
  int16: 3,
  uint16: 4,
  int32: 5,
  uint32: 6,
  float32: 7,
  float64: 8,
} as const

export const VectorBaseTypeInverse = {
  1: 'int8',
  2: 'uint8',
  3: 'int16',
  4: 'uint16',
  5: 'int32',
  6: 'uint32',
  7: 'float32',
  8: 'float64',
} as const

/**
  int8, 
  uint8, 
  int16, 
  uint16, 
  int32, 
  uint32, 
  float32, 
  float64 
 */
export type VectorBaseTypeEnum = (typeof VectorBaseType)[keyof typeof VectorBaseType]

export const FilterMaxVectorScore = 9999999
export const FilterMaxStringScore = 255
export const FilterAlignment = {
  notSet: 255,
} as const

export const FilterAlignmentInverse = {
  255: 'notSet',
} as const

/**
  notSet 
 */
// this needs number because it has a any (_) condition
export type FilterAlignmentEnum = 255 | (number & {})

export type AggHeader = {
  op: QueryTypeEnum
  typeId: TypeId
  offset: number
  limit: number
  filterSize: number
  iteratorType: QueryIteratorTypeEnum
  size: number
  resultsSize: number
  accumulatorSize: number
  sort: boolean
  hasGroupBy: boolean
  isSamplingSet: boolean
}

export const AggHeaderByteSize = 21

export const writeAggHeader = (
  buf: Uint8Array,
  header: AggHeader,
  offset: number,
): number => {
  buf[offset] = header.op
  offset += 1
  writeUint16(buf, header.typeId, offset)
  offset += 2
  writeUint32(buf, header.offset, offset)
  offset += 4
  writeUint32(buf, header.limit, offset)
  offset += 4
  writeUint16(buf, header.filterSize, offset)
  offset += 2
  buf[offset] = header.iteratorType
  offset += 1
  writeUint16(buf, header.size, offset)
  offset += 2
  writeUint16(buf, header.resultsSize, offset)
  offset += 2
  writeUint16(buf, header.accumulatorSize, offset)
  offset += 2
  buf[offset] = 0
  buf[offset] |= (((header.sort ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= (((header.hasGroupBy ? 1 : 0) >>> 0) & 1) << 1
  buf[offset] |= (((header.isSamplingSet ? 1 : 0) >>> 0) & 1) << 2
  buf[offset] |= ((0 >>> 0) & 31) << 3
  offset += 1
  return offset
}

export const writeAggHeaderProps = {
  op: (buf: Uint8Array, value: QueryTypeEnum, offset: number) => {
    buf[offset] = value
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset + 1)
  },
  offset: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 3)
  },
  limit: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 7)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 11)
  },
  iteratorType: (buf: Uint8Array, value: QueryIteratorTypeEnum, offset: number) => {
    buf[offset + 13] = value
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 14)
  },
  resultsSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 16)
  },
  accumulatorSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 18)
  },
  sort: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 20] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  hasGroupBy: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 20] |= (((value ? 1 : 0) >>> 0) & 1) << 1
  },
  isSamplingSet: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 20] |= (((value ? 1 : 0) >>> 0) & 1) << 2
  },
}

export const readAggHeader = (
  buf: Uint8Array,
  offset: number,
): AggHeader => {
  const value: AggHeader = {
    op: (buf[offset]) as QueryTypeEnum,
    typeId: (readUint16(buf, offset + 1)) as TypeId,
    offset: readUint32(buf, offset + 3),
    limit: readUint32(buf, offset + 7),
    filterSize: readUint16(buf, offset + 11),
    iteratorType: (buf[offset + 13]) as QueryIteratorTypeEnum,
    size: readUint16(buf, offset + 14),
    resultsSize: readUint16(buf, offset + 16),
    accumulatorSize: readUint16(buf, offset + 18),
    sort: (((buf[offset + 20] >>> 0) & 1)) === 1,
    hasGroupBy: (((buf[offset + 20] >>> 1) & 1)) === 1,
    isSamplingSet: (((buf[offset + 20] >>> 2) & 1)) === 1,
  }
  return value
}

export const readAggHeaderProps = {
  op: (buf: Uint8Array, offset: number): QueryTypeEnum => {
    return (buf[offset]) as QueryTypeEnum
  },
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset + 1)) as TypeId
  },
  offset: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 3)
  },
  limit: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 7)
  },
  filterSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 11)
  },
  iteratorType: (buf: Uint8Array, offset: number): QueryIteratorTypeEnum => {
    return (buf[offset + 13]) as QueryIteratorTypeEnum
  },
  size: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 14)
  },
  resultsSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 16)
  },
  accumulatorSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 18)
  },
  sort: (buf: Uint8Array, offset: number): boolean => {
    return (((buf[offset + 20] >>> 0) & 1)) === 1
  },
  hasGroupBy: (buf: Uint8Array, offset: number): boolean => {
    return (((buf[offset + 20] >>> 1) & 1)) === 1
  },
  isSamplingSet: (buf: Uint8Array, offset: number): boolean => {
    return (((buf[offset + 20] >>> 2) & 1)) === 1
  },
}

export const createAggHeader = (header: AggHeader): Uint8Array => {
  const buffer = new Uint8Array(AggHeaderByteSize)
  writeAggHeader(buffer, header, 0)
  return buffer
}

export type addMultiSubscriptionHeader = {
  typeId: number
}

export const addMultiSubscriptionHeaderByteSize = 2

export const writeaddMultiSubscriptionHeader = (
  buf: Uint8Array,
  header: addMultiSubscriptionHeader,
  offset: number,
): number => {
  writeUint16(buf, header.typeId, offset)
  offset += 2
  return offset
}

export const writeaddMultiSubscriptionHeaderProps = {
  typeId: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset)
  },
}

export const readaddMultiSubscriptionHeader = (
  buf: Uint8Array,
  offset: number,
): addMultiSubscriptionHeader => {
  const value: addMultiSubscriptionHeader = {
    typeId: readUint16(buf, offset),
  }
  return value
}

export const readaddMultiSubscriptionHeaderProps = {
  typeId: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset)
  },
}

export const createaddMultiSubscriptionHeader = (header: addMultiSubscriptionHeader): Uint8Array => {
  const buffer = new Uint8Array(addMultiSubscriptionHeaderByteSize)
  writeaddMultiSubscriptionHeader(buffer, header, 0)
  return buffer
}

export type removeMultiSubscriptionHeader = {
  typeId: number
}

export const removeMultiSubscriptionHeaderByteSize = 2

export const writeremoveMultiSubscriptionHeader = (
  buf: Uint8Array,
  header: removeMultiSubscriptionHeader,
  offset: number,
): number => {
  writeUint16(buf, header.typeId, offset)
  offset += 2
  return offset
}

export const writeremoveMultiSubscriptionHeaderProps = {
  typeId: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset)
  },
}

export const readremoveMultiSubscriptionHeader = (
  buf: Uint8Array,
  offset: number,
): removeMultiSubscriptionHeader => {
  const value: removeMultiSubscriptionHeader = {
    typeId: readUint16(buf, offset),
  }
  return value
}

export const readremoveMultiSubscriptionHeaderProps = {
  typeId: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset)
  },
}

export const createremoveMultiSubscriptionHeader = (header: removeMultiSubscriptionHeader): Uint8Array => {
  const buffer = new Uint8Array(removeMultiSubscriptionHeaderByteSize)
  writeremoveMultiSubscriptionHeader(buffer, header, 0)
  return buffer
}

export type AggProp = {
  propId: number
  propType: PropTypeEnum
  propDefStart: number
  aggFunction: AggFunctionEnum
  resultPos: number
  accumulatorPos: number
}

export const AggPropByteSize = 9

export const writeAggProp = (
  buf: Uint8Array,
  header: AggProp,
  offset: number,
): number => {
  buf[offset] = header.propId
  offset += 1
  buf[offset] = header.propType
  offset += 1
  writeUint16(buf, header.propDefStart, offset)
  offset += 2
  buf[offset] = header.aggFunction
  offset += 1
  writeUint16(buf, header.resultPos, offset)
  offset += 2
  writeUint16(buf, header.accumulatorPos, offset)
  offset += 2
  return offset
}

export const writeAggPropProps = {
  propId: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset] = value
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 1] = value
  },
  propDefStart: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 2)
  },
  aggFunction: (buf: Uint8Array, value: AggFunctionEnum, offset: number) => {
    buf[offset + 4] = value
  },
  resultPos: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 5)
  },
  accumulatorPos: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 7)
  },
}

export const readAggProp = (
  buf: Uint8Array,
  offset: number,
): AggProp => {
  const value: AggProp = {
    propId: buf[offset],
    propType: (buf[offset + 1]) as PropTypeEnum,
    propDefStart: readUint16(buf, offset + 2),
    aggFunction: (buf[offset + 4]) as AggFunctionEnum,
    resultPos: readUint16(buf, offset + 5),
    accumulatorPos: readUint16(buf, offset + 7),
  }
  return value
}

export const readAggPropProps = {
  propId: (buf: Uint8Array, offset: number): number => {
    return buf[offset]
  },
  propType: (buf: Uint8Array, offset: number): PropTypeEnum => {
    return (buf[offset + 1]) as PropTypeEnum
  },
  propDefStart: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 2)
  },
  aggFunction: (buf: Uint8Array, offset: number): AggFunctionEnum => {
    return (buf[offset + 4]) as AggFunctionEnum
  },
  resultPos: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 5)
  },
  accumulatorPos: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 7)
  },
}

export const createAggProp = (header: AggProp): Uint8Array => {
  const buffer = new Uint8Array(AggPropByteSize)
  writeAggProp(buffer, header, 0)
  return buffer
}

export type AggGroupByKey = {
  propId: number
  propType: PropTypeEnum
  propDefStart: number
}

export const AggGroupByKeyByteSize = 4

export const writeAggGroupByKey = (
  buf: Uint8Array,
  header: AggGroupByKey,
  offset: number,
): number => {
  buf[offset] = header.propId
  offset += 1
  buf[offset] = header.propType
  offset += 1
  writeUint16(buf, header.propDefStart, offset)
  offset += 2
  return offset
}

export const writeAggGroupByKeyProps = {
  propId: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset] = value
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 1] = value
  },
  propDefStart: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 2)
  },
}

export const readAggGroupByKey = (
  buf: Uint8Array,
  offset: number,
): AggGroupByKey => {
  const value: AggGroupByKey = {
    propId: buf[offset],
    propType: (buf[offset + 1]) as PropTypeEnum,
    propDefStart: readUint16(buf, offset + 2),
  }
  return value
}

export const readAggGroupByKeyProps = {
  propId: (buf: Uint8Array, offset: number): number => {
    return buf[offset]
  },
  propType: (buf: Uint8Array, offset: number): PropTypeEnum => {
    return (buf[offset + 1]) as PropTypeEnum
  },
  propDefStart: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 2)
  },
}

export const createAggGroupByKey = (header: AggGroupByKey): Uint8Array => {
  const buffer = new Uint8Array(AggGroupByKeyByteSize)
  writeAggGroupByKey(buffer, header, 0)
  return buffer
}


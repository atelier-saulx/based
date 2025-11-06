export const ID = {
  baseSize: 9, // queryType(1) + type(2) + id(4) + filterSize(2)
  queryType: 0,
  type: 1,
  id: 3,
  filterSize: 7,
  filter: 9,
}

export const ALIAS = {
  baseSize: 8, // queryType(1) + type(2) + prop(1) + aliasSize(2) + filterSize(2)
  queryType: 0,
  type: 1,
  prop: 3,
  aliasSize: 4,
  aliasValue: 6,
  filterSize: 6,
  filter: 8,
}

export const IDS = {
  baseSize: 21, // queryType(1) + type(2) + idsSize(4) + offset(4) + limit(4) + filterSize(2) + sortSize(2) + searchSize(2)
  queryType: 0,
  type: 1,
  idsSize: 3,
  idsValue: 7,
}

export const REFERENCES = {
  baseSize: 18, // includeOp(1) + size(2) + filterSize(2) + sortSize(2) + offset(4) + limit(4) + type(2) + prop(1)
  includeOp: 0,
  size: 1,
  filterSize: 3,
  sortSize: 5,
  offset: 7,
  limit: 11,
  filter: 15,
}

export const REFERENCE = {
  baseSize: 6, // includeOp(1) + size(2) + type(2) + prop(1)
  includeOp: 0,
  sizeOffset: 1,
  type: 3,
  prop: 5,
}

export const DEFAULT = {
  baseSize: 18, // queryType(1) + type(2) + offset(4) + limit(4) + filterSize(2) + isSimple(1) + sortSize(2) + searchSize(2)
}

export const REFS_AGGREGATION = {
  baseSize: 13,
  includeOp: 0,
  size: 1,
  filterSize: 3,
  offset: 5,
  filter: 9,
  typeId: 9, // 9 + filterSize
  prop: 11, // 9 + 2 + filterSize
  aggregateBuffer: 12, // 9 + 3 + filterSize
}

export const AGGREGATES = {
  baseSize: 16,
  queryType: 0,
  type: 1,
  offset: 3,
  limit: 7,
  filterSize: 11,
  filter: 13,
  aggregateSize: 14, // 14 + filterSize
  aggregateBuffer: 16, // 16 + filterSize
}

export const ID = {
  baseSize: 9, // queryType(1) + type(2) + id(4) + filterSize(2)
  queryType: 0,
  type: 1,
  id: 3,
  filterSize: 7,
  filter: 9,
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

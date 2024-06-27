export type CacheValue = {
  v: any // value
  c: number // checksum
  p?: boolean // persistent
  s?: number // size
}

export type Cache = Map<number, CacheValue>

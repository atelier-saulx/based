export type CacheValue = {
  v: any // value
  c: number // checksum
  p?: boolean // persitent
  t?: number // lastUpdated
  s?: number // size
}

export type Cache = Map<number, CacheValue>

export type CacheValue = {
  v: any // value
  c: number // checksum
  p?: boolean // persitent
  s?: number // size
}

export type Cache = Map<number, CacheValue>

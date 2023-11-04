export type CacheValue = {
  v: any
  c: number
  p?: boolean
}

export type Cache = Map<number, CacheValue>

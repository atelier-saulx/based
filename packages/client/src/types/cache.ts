export type CacheValue = {
  value: any
  checksum: number
  persistent?: boolean
}

export type Cache = Map<number, CacheValue>

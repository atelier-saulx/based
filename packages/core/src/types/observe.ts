export type ObserveMetaInfo = {
  id: string
  checksum: number
  name: string
}

export type ObserveOpts = {
  maxCacheSize?: number // in bytes
  localStorage?: boolean
}

export type observeDataListener = (data?: any, opts?: ObserveMetaInfo) => void

export type observeErrorListener = (err: Error, opts?: ObserveMetaInfo) => void

export type closeObserve = (opts?: ObserveMetaInfo) => void

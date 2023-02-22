// -------- abstract ---------
export type GenericObject = {
  [key: string]: any
}

// -------- generic based ---------
export type BasedOpts = {
  env?: string
  project?: string
  org?: string
  cluster?: string
  name?: string
  key?: string
  url?: string | (() => Promise<string>)
  discoveryUrls?: string[]
  params?: {
    [key: string]: string | number
  }
}

export type Settings = {
  maxCacheSize?: number
  persistentStorage?: string
}

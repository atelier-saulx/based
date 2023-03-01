// -------- abstract ---------
export type GenericObject = {
  [key: string]: any
}

// -------- generic based ---------

export type BasedUrlFn = () => Promise<string>

export type BasedOpts = {
  env?: string
  project?: string
  org?: string
  cluster?: string
  name?: string
  key?: string
  optionalKey?: boolean
  url?: string | BasedUrlFn
  discoveryUrls?: string[]
  params?: {
    [key: string]: string | number
  }
}

export type Settings = {
  maxCacheSize?: number
  persistentStorage?: string
}

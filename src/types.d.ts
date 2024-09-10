import { BasedFunctionConfig } from '@based/functions'

declare global {
  namespace BasedCli {
    type ConfigBase = BasedFunctionConfig & {
      appParams?: {
        js?: string
        css?: string
        favicon?: string
      }
      files?: string[]
    }

    type ConfigStore = {
      config: ConfigBase
      path: string
      dir: string
      index?: string
      app?: string
      favicon?: string
    }
  }
}

export {}

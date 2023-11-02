// import { ConnectOptions, ServerType } from '@saulx/selva'
// TODO: fix the import
type ConnectOptions = any
type ServerType = any

export type ServerOptions = {
  port: number
  name?: string
  dir?: string
  save?: boolean | { seconds: number }
  env?: NodeJS.ProcessEnv
  default?: boolean
}

export type Stats = {
  cpu: number
  activeChannels: number
  opsPerSecond: number
  timestamp: number
}

export type Options =
  | ServerOptions
  | (() => Promise<ServerOptions>)
  | Promise<ServerOptions>

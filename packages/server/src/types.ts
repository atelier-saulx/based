// import { ConnectOptions, ServerType } from '@saulx/selva'
import { StdioOptions } from 'child_process'

// TODO: fix the import
// type ConnectOptions = any
// type ServerType = any

export type ServerOptions = {
  port: number
  name?: string
  dir?: string
  save?: boolean | { seconds: number }
  env?: NodeJS.ProcessEnv
  stdio?: StdioOptions | undefined
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

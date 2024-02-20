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
  ldLibraryPath?: string // glibc lib folder path Ex: '/opt/glibc-2.38/lib:/lib64'
  ldExecutablePath?: string // ld executable path Ex: '/opt/glibc-2.38/lib/ld-linux-x86-64.so.2'
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

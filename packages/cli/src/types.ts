import { AuthState } from '@based/client'

export type Opts = {
  noCloud?: boolean
  env?: string
  cluster?: string
  project?: string
  token?: AuthState
  org?: string
  url?: string
  force?: boolean
  watch?: boolean
  cwd?: string
  hub?: string
  args: string[] | undefined
  name?: string
  value?: string
}

export type Props = {
  opts: Opts
  command: 'dev' | 'deploy' | 'secrets' | 'init' | 'status' | 'logout'
}

export type EventType = {
  id?: number
  msg: string
  type: 'init' | 'deploy' | 'runtime' | 'security'
  level: 'info' | 'error' | 'warn' | 'debug'
  meta?: string
  function?: {
    id?: number
    name: string
    checksum?: number
  }
  createdAt?: number
}

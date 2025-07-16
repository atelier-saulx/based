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
}

export type Props = {
  opts: Opts
  command: 'dev' | 'deploy' | 'secrets' | 'init' | 'status' | 'logout'
}

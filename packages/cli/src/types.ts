export type Opts = {
  noCloud: boolean
  env: string
  cluster: string
  project: string
  token: string
  org: string
  url: string
  force: boolean
  watch: boolean
  cwd: string
}

export type Props = {
  opts: Opts
  command: 'dev' | 'deploy' | 'secrets' | 'init' | 'status' | 'logout'
}

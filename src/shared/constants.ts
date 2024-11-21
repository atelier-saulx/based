import { homedir } from 'node:os'
import { join } from 'node:path'

export const LINE_NEW = '\n'
export const LINE_START = '\r'
export const LINE_UP = '\x1b[F'
export const LINE_DOWN = '\x1b[E'
export const INTERNAL_PATH: string = join(homedir(), '.based/cli')
export const LOCAL_AUTH_INFO: string = join(
  INTERNAL_PATH as string,
  'auth.json',
)
export const CONNECTION_TIMEOUT: number = 60e3

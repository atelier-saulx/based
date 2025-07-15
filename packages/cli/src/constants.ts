import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
export const PERSISTENT_STORAGE = resolve(join(homedir(), '.based/cli'))

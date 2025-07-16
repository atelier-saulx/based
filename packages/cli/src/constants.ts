import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const BASED_DIR = resolve(join(homedir(), '.based'))
export const PERSISTENT_STORAGE = join(BASED_DIR, 'cli')
export const SOURCEMAPS_DIR = join(BASED_DIR, 'sourcemaps')
export const TMP_DIR = join(tmpdir(), 'based-cli')

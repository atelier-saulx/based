import { isAbsolute, join, relative } from 'node:path'

export * from './getBasedClient.js'
export * from './login.js'
export * from './spinner.js'
export * from './getMyIp.js'
export * from './getTargets.js'
export * from './getEnv.js'
export * from './parseFunctions.js'
export * from './parseSchema.js'
export * from './buildFunctions.js'
export * from './invalidate.js'
export * from './auth.js'

export const cwd = process.cwd()
export const rel = (str: string) => relative(cwd, str)
export const abs = (str: string, dir: string) =>
  isAbsolute(str) ? str : join(dir, str)

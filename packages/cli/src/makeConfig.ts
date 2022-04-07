import chalk from 'chalk'
import findConfig from './findConfig'
import { prefixDebug, printDebug } from './tui'
import { Config } from './types'

export const makeConfig = async (options: any): Promise<Config> => {
  const basedFileConfig = (await findConfig(options.basedFile)) || {}
  const config = {
    ...basedFileConfig,
    ...(options.cluster ? { cluster: options.cluster } : null),
    ...(options.org ? { org: options.org } : null),
    ...(options.project ? { project: options.project } : null),
    ...(options.env ? { env: options.env } : null),
  }
  if (options.debug) {
    console.info(prefixDebug + chalk.gray('config:'))
    printDebug(config)
  }
  return config
}

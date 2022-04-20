import chalk from 'chalk'
import { prefix, prefixWarn } from '.'
import { Config } from '../types'

export const printConfig = (config: Config) => {
  if (!config) return
  if (config.cluster) {
    console.info(prefixWarn + chalk.gray('Cluster: ') + config.cluster)
  }
  console.info(
    prefix +
      chalk.gray('Org: ') +
      (config.org || chalk.gray('-')) +
      ' ' +
      chalk.gray('Project: ') +
      (config.project || chalk.gray('-')) +
      ' ' +
      chalk.gray('Env: ') +
      (config.env || chalk.gray('-'))
  )
}

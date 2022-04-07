import { program } from 'commander'
import chalk from 'chalk'
import { printEmptyLine, printAction } from '.'
import { printConfig } from './config'
import { Config } from '../types'

const basedLogoAscii =
  ' _                        _ \n' +
  '| |                      | |\n' +
  '| |__   __ _ ___  ___  __| |\n' +
  "| '_ \\ / _` / __|/ _ \\/ _` |\n" +
  '| |_) | (_| \\__ \\  __/ (_| |\n' +
  '|_.__/ \\__,_|___/\\___|\\__,_|'

export const printBasedLogo = () => {
  console.info(chalk.blackBright(basedLogoAscii))
}

export const printBasedCliLogoWithVersion = (version: string) => {
  console.info(chalk.blackBright(basedLogoAscii))
  const logoWidth = 28
  const spaces = ' '.repeat(
    logoWidth - 3 - (version ? String(version).length + 2 : 0)
  )
  console.info(
    spaces +
      chalk.blue('CLI') +
      (version ? ' ' + chalk.blackBright('v' + version) : '')
  )
}

export const printHeader = (options: any, config: Config, action?: string) => {
  if (options.output === 'fancy') {
    // @ts-ignore
    printBasedCliLogoWithVersion(program._version)
    printEmptyLine(false)
    printConfig(config)
    if (action) {
      printAction(action)
    }
  }
}

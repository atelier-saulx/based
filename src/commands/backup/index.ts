export * from './download/index.js'
export * from './flush/index.js'
export * from './list/index.js'
export * from './make/index.js'
export * from './restore/index.js'

import { Command } from 'commander'
import { make } from './make/index.js'
import { list } from './list/index.js'
import { restore } from './restore/index.js'
import { flush } from './flush/index.js'
import { download } from './download/index.js'
import { AppContext } from '../../shared/index.js'

export const backup = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const subCommands: Based.Commands.SubCommandsList = {
    make,
    list,
    download,
    restore,
    flush,
  }

  context.commandMaker('backups', subCommands)
}

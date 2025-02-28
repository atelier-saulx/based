import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import { clear } from './clear/index.js'
import { filter } from './filter/index.js'

export const logs = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const subCommands: Based.Commands.SubCommandsList = {
    filter,
    clear,
  }

  context.commandMaker('logs', subCommands)
}

import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import { get } from './get/index.js'
import { set } from './set/index.js'

export const secrets = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const subCommands: Based.Commands.SubCommandsList = {
    get,
    set,
  }

  context.commandMaker('secrets', subCommands)
}

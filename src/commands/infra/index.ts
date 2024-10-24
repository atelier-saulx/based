import { Command } from 'commander'
import { init } from './init/index.js'
import { AppContext } from '../../shared/AppContext.js'

export const infra = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const subCommands: Based.Commands.SubCommandsList = {
    init,
  }

  context.commandMaker('infra', subCommands)
}

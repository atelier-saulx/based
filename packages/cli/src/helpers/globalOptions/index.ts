import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'

export const globalOptions = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('globalOptions')
  const { option, command } = context.i18n('help')

  cmd.helpOption(option.parameter, option.description)
  cmd.helpCommand(command.parameter, command.description)
}

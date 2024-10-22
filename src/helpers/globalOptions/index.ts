import { Command } from 'commander'
import { AppContext } from '../../shared/index.js'

export const globalOptions = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)

  program = context.commandMaker('globalOptions')

  const { option, command } = context.i18n('help')

  program.helpOption(option.parameter, option.description)
  program.helpCommand(command.parameter, command.description)
}

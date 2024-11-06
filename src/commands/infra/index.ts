export * from './init/index.js'
export * from './overview/index.js'

import { Command } from 'commander'
import { init } from './init/index.js'
import { get } from './get/index.js'
import { overview } from './overview/index.js'
import { AppContext } from '../../shared/AppContext.js'

export const infra = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const subCommands: Based.Commands.SubCommandsList = {
    init,
    get,
    overview,
  }

  context.commandMaker('infra', subCommands)
}

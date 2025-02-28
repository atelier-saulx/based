export * from './init/index.js'
export * from './overview/index.js'

import type { Command } from 'commander'
import { AppContext } from '../../context/AppContext.js'
import { get } from './get/index.js'
import { infraInit } from './init/index.js'
import { overview } from './overview/index.js'

export const infra = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const subCommands: Based.Commands.SubCommandsList = {
    init: infraInit,
    get,
    overview,
  }

  context.commandMaker('infra', subCommands)
}

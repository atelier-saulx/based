import type { Command } from 'commander'
import { AppContext, logout } from '../../shared/index.js'

export const disconnect = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('disconnect')

  cmd.action(async () => {
    try {
      await logout()
    } catch (error) {
      throw new Error(error)
    }
  })
}

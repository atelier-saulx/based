import type { Command } from 'commander'
import { AppContext, login } from '../../shared/index.js'

export const auth = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('auth')

  cmd.action(async ({ email }) => {
    try {
      const { destroy } = await login({
        email,
        selectUser: true,
      })

      destroy()
    } catch (error) {
      throw new Error(error)
    }
  })
}

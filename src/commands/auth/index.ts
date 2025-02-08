import type { Command } from 'commander'
import { AppContext, newLogin } from '../../shared/index.js'

export const auth = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('auth')

  cmd.action(async (args: Based.Auth.Command) => {
    const { email } = args

    try {
      const { destroy } = await newLogin(email)

      destroy()
    } catch (error) {
      throw new Error(error)
    }
  })
}

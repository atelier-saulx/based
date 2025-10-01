import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import { login } from '../../shared/index.js'

export const auth = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('auth')

  cmd.action(async (args: Based.Auth.Command) => {
    const { email } = args

    try {
      const { destroy } = await login(email)

      destroy()
    } catch (error) {
      throw new Error(error)
    }
  })
}

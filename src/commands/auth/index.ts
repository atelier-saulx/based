import { Command } from 'commander'
import { login } from '../../shared/index.js'

export const auth = async (program: Command): Promise<void> => {
  const cmd: Command = program
    .command('auth')
    .description('Authorize your user in the Based Cloud.')
    .option('--email <email>', 'To speed up the login process.')

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

import { Command } from 'commander'
import { login, AppContext } from '../../shared/index.js'

export const auth = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = program
    .command('auth')
    .description('Authorize your user in the Based Cloud.')
    .option('--email <email>', 'To speed up the login process.')

  cmd.action(async ({ email }) => {
    const { cluster, org, env, project } = await context.getProgram()

    try {
      const { destroy } = await login({
        context,
        email,
        cluster,
        org,
        env,
        project,
        selectUser: true,
      })

      destroy()
    } catch (error) {
      throw new Error(error)
    }
  })
}

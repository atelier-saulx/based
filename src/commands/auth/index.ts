import { Command } from 'commander'
import { login } from '../../shared/index.js'
import AppContext from '../../shared/AppContext.js'

export const auth = async (
  program: Command,
  context: AppContext,
): Promise<void> => {
  const cmd: Command = program
    .command('auth')
    .description('Authorize your user in the Based Cloud.')
    .option('--email <email>', 'To speed up the login process.')

  cmd.action(async ({ email }) => {
    const { cluster, org, env, project } = program.opts()

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
  })
}

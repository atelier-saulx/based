import { Command } from 'commander'
import { login } from '../../shared/index.js'

type AuthFunction = (program: Command) => Promise<void>

export const auth: AuthFunction = async (program: Command): Promise<void> => {
  const cmd: Command = program
    .command('auth')
    .description('Authorize your user in the Based Cloud.')
    .option('--email <email>', 'To speed up the login process.')

  cmd.action(async ({ email }) => {
    const { cluster, org, env, project } = program.opts()

    const { destroy } = await login({
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

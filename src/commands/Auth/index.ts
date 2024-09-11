import { Command } from 'commander'
import { login } from '../../shared/index.js'

export const auth = async (program: Command) => {
  const cmd: Command = program
    .command('auth')
    .description('Authorize your user in the Based Cloud.')
    .option('--email <email>', 'To set manually the Based Dev Server port.')

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

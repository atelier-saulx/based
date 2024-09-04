import { Command } from 'commander'
import { login } from '../../shared/login.js'

export const auth = async (program: Command) => {
  const cmd: Command = program.command('auth')

  cmd.action(async () => {
    const { cluster, org, env, project } = program.opts()
    const { destroy } = await login({
      cluster,
      org,
      env,
      project,
      selectUser: true,
    })
    destroy()
  })
}

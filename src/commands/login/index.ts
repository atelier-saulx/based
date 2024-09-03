import { Command } from 'commander'
import { login as loginFn } from '../../shared/login.js'

export const login = async (program: Command) => {
  const cmd = program.command('login')
  cmd.action(async () => {
    const { destroy } = await loginFn(program, true)
    destroy()
  })
}

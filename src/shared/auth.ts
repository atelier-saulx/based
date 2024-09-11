import { login } from './login.js'
import { Command } from 'commander'
import { BasedClient } from '@based/client'

export const basedAuth = async (
  program: Command,
): Promise<{ basedClient: BasedClient; destroy: () => void }> => {
  const { cluster, org, env, project } = program.opts()
  const { client, destroy } = await login({ cluster, org, env, project })

  return { basedClient: client, destroy }
}

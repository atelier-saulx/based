import { login } from './login.js'
import { Command } from 'commander'
import { BasedClient } from '@based/client'

export const basedAuth = async (
  program: Command,
): Promise<{
  basedClient: BasedClient
  adminHubBasedCloud: BasedClient
  envHubBasedCloud: BasedClient
  destroy: () => void
}> => {
  const { cluster, org, env, project } = program.opts()
  const { client, adminHub, envHub, destroy } = await login({
    cluster,
    org,
    env,
    project,
  })

  return {
    basedClient: client,
    adminHubBasedCloud: adminHub,
    envHubBasedCloud: envHub,
    destroy,
  }
}

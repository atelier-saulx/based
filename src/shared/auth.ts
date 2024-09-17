import { login } from './login.js'
import { Command } from 'commander'
import { BasedClient } from '@based/client'
import { spinner } from './spinner.js'

type BasedAuthReturn = {
  basedClient: BasedClient
  adminHubBasedCloud: BasedClient
  envHubBasedCloud: BasedClient
  destroy: () => void
}

export const basedAuth = async (program: Command): Promise<BasedAuthReturn> => {
  const { cluster, org, env, project } = program.opts()
  const { client, adminHub, envHub, destroy } = await login({
    cluster,
    org,
    env,
    project,
  })

  if (!client || !adminHub || !envHub) {
    spinner.fail(
      `Fatal error during authorization. Check your 'based.json' configuration file and try again.`,
    )
    process.exit(1)
  }

  return {
    basedClient: client,
    adminHubBasedCloud: adminHub,
    envHubBasedCloud: envHub,
    destroy,
  }
}

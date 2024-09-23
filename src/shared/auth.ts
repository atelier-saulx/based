import { login } from './login.js'
import { Command } from 'commander'
import { BasedClient } from '@based/client'
import AppContext from './AppContext.js'

type BasedAuthReturn = {
  basedClient: BasedClient
  adminHubBasedCloud: BasedClient
  envHubBasedCloud: BasedClient
  destroy: () => void
}

export const basedAuth = async (
  program: Command,
  context: AppContext,
): Promise<BasedAuthReturn> => {
  const { cluster, org, env, project } = program.opts()
  const { client, adminHub, envHub, destroy } = await login({
    cluster,
    org,
    env,
    project,
    context,
  })

  if (!client || !adminHub || !envHub) {
    context.print.fail(
      `Fatal error during authorization. Check your 'based.json' configuration file and try again.`,
    )
  }

  return {
    basedClient: client,
    adminHubBasedCloud: adminHub,
    envHubBasedCloud: envHub,
    destroy,
  }
}

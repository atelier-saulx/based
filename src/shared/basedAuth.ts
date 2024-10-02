import { login } from './login.js'
import { BasedClient } from '@based/client'
import { AppContext } from './AppContext.js'

type BasedAuthReturn = {
  basedClient: BasedClient
  adminHubBasedCloud: BasedClient
  envHubBasedCloud: BasedClient
  destroy: () => void
}

export const basedAuth = async (
  context: AppContext,
): Promise<BasedAuthReturn> => {
  const { cluster, org, env, project } = context.get('project')
  const { client, adminHub, envHub, destroy } = await login({
    cluster,
    org,
    env,
    project,
    context,
  })

  if (!client || !adminHub || !envHub) {
    throw new Error(
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

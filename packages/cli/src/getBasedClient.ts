import { BasedClient, BasedOpts } from '@based/client'
import { program } from './index.js'

let basedClient: BasedClient

export const getBasedClient = () => {
  if (basedClient) {
    return basedClient
  }

  const { cluster, org, project, env, envDiscoveryUrl } =
    program.optsWithGlobals()

  const envHubConfig: BasedOpts = {
    org,
    project,
    env,
    cluster,
    key: 'cms',
    optionalKey: true,
  }
  if (envDiscoveryUrl) {
    envHubConfig.discoveryUrls = [envDiscoveryUrl]
  }

  basedClient = new BasedClient(envHubConfig)
  return basedClient
}

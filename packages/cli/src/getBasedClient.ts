import { BasedClient, BasedOpts } from '@based/client'
import { outputFile } from 'fs-extra/esm'
import { PERSISTENT_STORAGE, program } from './index.js'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { login } from './login.js'

let basedClient: BasedClient

export const getBasedClient = async () => {
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

  basedClient.on('authstate-change', (authState) => {
    outputFile(join(PERSISTENT_STORAGE, cluster), JSON.stringify(authState))
  })

  try {
    const { userId, token } = JSON.parse(
      await readFile(join(PERSISTENT_STORAGE, cluster), 'utf8'),
    )
    console.log({ userId, token })
    if (!userId || !token) {
      throw new Error('empty persistentStorage')
    }
    if (basedClient.authState?.token !== token) {
      const authState = await basedClient.setAuthState({
        userId,
        token,
        type: 'based',
      })
      await new Promise((resolve) => setTimeout(resolve, 200))
      if (authState.error) {
        throw new Error(authState.error)
      }
    }
  } catch (error) {
    await login()
  }

  return basedClient
}

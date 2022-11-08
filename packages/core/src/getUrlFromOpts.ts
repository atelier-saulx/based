import { BasedOpts } from './types'
import getService, { getClusterUrl } from '@based/get-service'

export default async (
  opts: BasedOpts
): Promise<string | (() => Promise<string>)> => {
  let { env, project, org, url, key, name = '@based/edge', cluster } = opts
  if (!url) {
    cluster = opts.cluster = getClusterUrl(cluster)

    opts.url = url = async () => {
      const { url } = await getService(
        {
          env,
          project,
          org,
          key,
          name,
        },
        0,
        cluster
      )
      return url
    }
  }
  return opts.url
}

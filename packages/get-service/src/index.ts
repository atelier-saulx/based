import fetch from 'cross-fetch'

// PRODUCTION
const DEFAULT_CLUSTER = 'https://d15p61sp2f2oaj.cloudfront.net'

const parsUrlRe = /^(?:(tcp|wss?|https?):\/\/)?([a-z0-9.-]*)(?::(\d+))?$/
const wait = (t = 1e3) =>
  new Promise((resolve) => {
    setTimeout(resolve, t)
  })

const SELECTOR_LIST =
  process?.env?.CLOUD === 'local'
    ? `http://${process?.env?.SERVICE_SELECTOR_LIST}`
    : `https://${process?.env?.SERVICE_SELECTOR_LIST}`

let registryIndex = 0

export const getClusterUrl = (cluster?: string): string => {
  if (!cluster) {
    return process?.env?.SERVICE_SELECTOR_LIST ? SELECTOR_LIST : DEFAULT_CLUSTER
  }
  if (cluster === 'local') {
    return 'http://localhost:7022'
  }
  return cluster
}

export type ServiceUrl = {
  protocol: string
  host: string
  port: number
  url: string
}

export default async function getService(
  opts:
    | {
        org?: string
        project?: string
        env?: string
        name: string
        key?: string
        optionalKey?: true
      }
    | string,
  retries: number = 0,
  cluster?: string
): Promise<ServiceUrl> {
  if (!cluster) {
    console.info('No cluster use selector list', SELECTOR_LIST)
    cluster = SELECTOR_LIST
  }

  if (!cluster) {
    throw new Error('No cluster url defined')
  }

  try {
    const registryUrls = await Promise.race([
      fetch(cluster).then(toJson).catch(toOblivion),
      wait(3e3),
    ])

    if (typeof opts === 'string') {
      opts = { name: opts }
    }

    if (!registryUrls) {
      throw new Error(
        `Cannot connect to service-selector-list within 5s, retrying...\n ${JSON.stringify(
          opts,
          null,
          2
        )}`
      )
    }

    const {
      org = process?.env?.ORG,
      project = process?.env?.PROJECT,
      env = process?.env?.ENV,
      name,
      key,
      optionalKey,
    } = opts
    let i = registryUrls.length
    let url

    while (i--) {
      const registryUrl =
        registryUrls[++registryIndex] || registryUrls[(registryIndex = 0)]
      url = await Promise.race([
        fetch(
          `${registryUrl}/${org}.${project}.${env}.${name}${
            key ? `.${key}` : ''
          }${optionalKey ? '$' : ''}`
        )
          .then(toText)
          .catch(toOblivion),
        wait(3e3),
      ])

      if (url) {
        const [, protocol, host, port] = parsUrlRe.exec(url)
        return { protocol, host, port: Number(port), url }
      }
    }
  } catch (e) {
    console.error(e.message)
  }

  retries++
  await wait(Math.min(retries * 1e3, 2e3))
  return getService(opts, retries, cluster)
}

function toText(r) {
  return r.text()
}

function toJson(r) {
  return r.json()
}

function toOblivion() {}

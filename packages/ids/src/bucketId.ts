import { envId as getEnvId } from '.'

export default (opts: {
  type: 'files' | 'backups' | 'dists'
  cloudProvider: string
  clusterName: string
  envId: string | { org: string; proj: string; env: string }
  service?: string
}): string => {
  if (!opts.envId) throw new Error('No endId')
  let envValue: string
  if (typeof opts.envId === 'object') {
    const { org, proj, env } = opts.envId
    envValue = getEnvId(env, org, proj)?.replaceAll(
      /([A-Z])/g,
      (x: string) => x.toLowerCase() + '-'
    )
  } else {
    envValue = opts.envId?.replaceAll(/([A-Z])/g, (x) => x.toLowerCase() + '-')
  }
  return `based-${opts.type}-${opts.cloudProvider}-${
    opts.clusterName
  }-${envValue}${opts.service ? '-' + opts.service : ''}x`.replaceAll(
    /([A-Z])/g,
    (x) => x.toLowerCase() + '-'
  )
}

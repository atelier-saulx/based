import based, { Based } from '@based/client'

export default (cluster: string): Based => {
  const client = based({
    org: 'saulx',
    project: 'based-core',
    env: 'shared-services',
    name: '@based/admin-server',
    cluster,
  })
  return client
}

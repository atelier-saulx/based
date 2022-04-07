import { join } from 'path'
import { hashCompact } from '@saulx/hash'

export default (cluster: string): string => {
  const homeDir =
    process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME']
  const p = join(
    homeDir,
    '.based',
    (cluster && cluster.includes('https://')
      ? hashCompact(cluster)
      : cluster) || 'default'
  )
  return p
}

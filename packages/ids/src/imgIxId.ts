import { hash } from '@saulx/hash'

export default (
  cloud: string,
  cluster: string,
  envId: string,
  orgId: string
): string => {
  return `based-${hash(`${cloud}-${cluster}-${envId}-${orgId}`)}`
}

export default ({
  type,
  cloud,
  cluster,
  envId,
  orgId,
}: {
  type: string
  cloud: string
  cluster: string
  envId: string
  orgId: string
}): string => {
  return `based-${type}-${cloud}-${cluster}-${envId}-${orgId}x`.replaceAll(
    /([A-Z])/g,
    (x) => x.toLowerCase() + '-'
  )
}

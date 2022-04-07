export default (
  cloud: string,
  cluster: string,
  envId: string,
  orgId: string
): string => {
  return `based-env-files-${cloud}-${cluster}-${envId}-${orgId}x`.replaceAll(
    /([A-Z])/g,
    (x) => x.toLowerCase() + '-'
  )
}

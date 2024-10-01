export const getLogs = async ({
  adminHubBasedCloud,
  envHubBasedCloud,
  cluster,
  org,
  env,
  project,
  filters,
  renderData,
}) => {
  const finalData = []
  const isOnlyApp: boolean = filters.app && !filters.infra
  const isOnlyInfra: boolean = !filters.app && filters.infra
  const isBoth: boolean = filters.app && filters.infra
  const isNone: boolean = !filters.app && !filters.infra

  if (isBoth || isOnlyInfra || isNone) {
    finalData.push(
      await adminHubBasedCloud
        .query('logs', {
          cluster,
          org,
          env,
          project,
        })
        .get(),
    )
  }

  if (isBoth || isOnlyApp || isNone) {
    finalData.push(await envHubBasedCloud.query('based:logs').get())
  }

  renderData(...finalData)
}

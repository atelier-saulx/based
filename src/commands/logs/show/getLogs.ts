export const getLogs = async ({
  adminHubBasedCloud,
  envHubBasedCloud,
  cluster,
  org,
  env,
  project,
  filters,
  newData,
}) => {
  const finalData = []

  if (
    (filters.app && filters.infra) ||
    (!filters.app && filters.infra) ||
    (!filters.app && !filters.infra)
  ) {
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

  if (
    (filters.app && filters.infra) ||
    (filters.app && !filters.infra) ||
    (!filters.app && !filters.infra)
  ) {
    finalData.push(await envHubBasedCloud.query('based:logs').get())
  }

  newData(...finalData)
}

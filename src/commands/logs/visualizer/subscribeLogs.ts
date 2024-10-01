import diff from 'arr-diff'
import { AdminLogsData, EnvLogsData } from './formatLogs.js'

export const subscribeLogs = async ({
  adminHubBasedCloud,
  envHubBasedCloud,
  cluster,
  org,
  env,
  project,
  filters,
  renderData,
}) => {
  let adminLogsPrevious: AdminLogsData[] = []
  let envLogsPrevious: EnvLogsData[] = []
  let finalAdminData = []
  let finalEnvData = []
  const isOnlyApp: boolean = filters.app && !filters.infra
  const isOnlyInfra: boolean = !filters.app && filters.infra
  const isBoth: boolean = filters.app && filters.infra
  const isNone: boolean = !filters.app && !filters.infra

  if (isBoth || isOnlyInfra || isNone) {
    await adminHubBasedCloud
      .query('logs', {
        cluster,
        org,
        env,
        project,
      })
      .subscribe(async (data: AdminLogsData[]) => {
        if (!Array.isArray(data)) {
          throw new Error('Fatal error reading your logs. Try again.')
        }

        const finalData = diff(adminLogsPrevious, data)
        finalAdminData.push(finalData)
        adminLogsPrevious = data
      })
  }

  if (isBoth || isOnlyApp || isNone) {
    await envHubBasedCloud
      .query('based:logs')
      .subscribe(async (data: EnvLogsData[]) => {
        if (!Array.isArray(data)) {
          throw new Error('Fatal error reading your logs. Try again.')
        }

        const finalData = diff(envLogsPrevious, data)
        finalEnvData.push(finalData)
        envLogsPrevious = data
      })
  }

  setInterval(() => {
    renderData(...finalAdminData, ...finalEnvData)

    finalAdminData = []
    finalEnvData = []
  }, 1000)
}

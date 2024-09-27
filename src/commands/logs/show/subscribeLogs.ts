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
  newData,
}) => {
  let adminLogsPrevious: AdminLogsData[] = []
  let envLogsPrevious: EnvLogsData[] = []
  let finalAdminData = []
  let finalEnvData = []

  if (
    (filters.app && filters.infra) ||
    (!filters.app && filters.infra) ||
    (!filters.app && !filters.infra)
  ) {
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

  if (
    (filters.app && filters.infra) ||
    (filters.app && !filters.infra) ||
    (!filters.app && !filters.infra)
  ) {
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
    newData(...finalAdminData, ...finalEnvData)

    finalAdminData = []
    finalEnvData = []
  }, 1000)
}

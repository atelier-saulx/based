import { AppContext } from '../../shared/index.js'
import { AdminLogsData, EnvLogsData } from './formatLogs.js'

export const getLogs = async (
  context: AppContext,
  filters: Based.Logs.Filter,
  renderData: (...data: AdminLogsData[] | EnvLogsData[]) => void,
) => {
  const { envHubBasedCloud, adminHubBasedCloud } =
    await context.getBasedClients()
  const { cluster, org, env, project } = await context.getProgram()
  const finalData = []
  const isOnlyApp: boolean = filters.app && !filters.infra
  const isOnlyInfra: boolean = !filters.app && filters.infra
  const isBoth: boolean = filters.app && filters.infra
  const isNone: boolean = !filters.app && !filters.infra

  context.print.stop()

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

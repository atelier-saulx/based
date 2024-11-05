import diff from 'arr-diff'
import { AppContext } from '../../shared/index.js'

export const subscribeLogs = async (
  context: AppContext,
  filters: Based.Logs.Filter,
  renderData: Based.Logs.RenderData,
) => {
  const basedClient = await context.getBasedClient()
  const { cluster, org, env, project } = await context.getProgram()
  let adminLogsPrevious: Based.Logs.AdminLogsData[] = []
  let envLogsPrevious: Based.Logs.EnvLogsData[] = []
  let finalAdminData = []
  let finalEnvData = []
  const isOnlyApp: boolean = filters.app && !filters.infra
  const isOnlyInfra: boolean = !filters.app && filters.infra
  const isBoth: boolean = filters.app && filters.infra
  const isNone: boolean = !isBoth

  context.print.stop()

  if (isBoth || isOnlyInfra || isNone) {
    basedClient
      .call(context.endpoints.LOGS_CLUSTER, {
        cluster,
        org,
        env,
        project,
      })
      .subscribe(async (data: Based.Logs.AdminLogsData[]) => {
        if (!Array.isArray(data)) {
          throw new Error('Fatal error reading your logs. Try again.')
        }

        const finalData = diff(adminLogsPrevious, data)

        finalAdminData.push(finalData)

        adminLogsPrevious = data
      })
  }

  if (isBoth || isOnlyApp || isNone) {
    basedClient
      .call(context.endpoints.LOGS_ENV)
      .subscribe(async (data: Based.Logs.EnvLogsData[]) => {
        if (!Array.isArray(data)) {
          throw new Error('Fatal error reading your logs. Try again.')
        }

        const finalData = diff(envLogsPrevious, data)

        finalEnvData.push(finalData)

        envLogsPrevious = data
      })
  }

  setInterval(() => {
    renderData([...finalAdminData, ...finalEnvData].flat())

    finalAdminData = []
    finalEnvData = []
  }, 1e3)
}

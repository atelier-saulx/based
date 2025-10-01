import type { AppContext } from '../../context/index.js'

const combineData = (a, b) => {
  const x = [...a, ...b].sort((a, b) =>
    a.ts > b.ts ? 1 : a.ts === b.ts ? 0 : -1,
  )

  // console.log({
  //   x: x.slice(-2).map((x) => {
  //     x.DATE = new Date(x.ts)
  //     return x
  //   }),
  // })
  return x
}

export const subscribeLogs = async (
  context: AppContext,
  args: Based.Logs.Filter.Command,
  renderData: Based.Logs.RenderData,
) => {
  const basedClient = await context.getBasedClient()
  const { cluster, org, env, project } = await context.getProgram()
  let finalAdminData = []
  let finalEnvData = []
  const isOnlyApp: boolean = args.app && !args.infra
  const isOnlyInfra: boolean = !args.app && args.infra
  const isBoth: boolean = args.app && args.infra
  const isNone: boolean = !isBoth

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
        finalAdminData = data
        // combineData(finalEnvData, finalAdminData)
        renderData(combineData(finalEnvData, finalAdminData))
      })
  }

  if (isBoth || isOnlyApp || isNone) {
    basedClient
      .call(context.endpoints.LOGS_ENV)
      .subscribe(async (data: Based.Logs.EnvLogsData[]) => {
        if (!Array.isArray(data)) {
          throw new Error('Fatal error reading your logs. Try again.')
        }
        finalEnvData = data
        // combineData(finalEnvData, finalAdminData)
        renderData(combineData(finalEnvData, finalAdminData))
      })
  }
}

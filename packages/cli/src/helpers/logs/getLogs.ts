import type { AppContext } from '../../context/index.js'

export const getLogs = async (
  context: AppContext,
  args: Based.Logs.Filter.Command,
  renderData: Based.Logs.RenderData,
) => {
  const basedClient = await context.getBasedClient()
  const { cluster, org, env, project } = await context.getProgram()
  const finalData = []
  const isOnlyApp: boolean = args.app && !args.infra
  const isOnlyInfra: boolean = !args.app && args.infra
  const isBoth: boolean = args.app && args.infra
  const isNone: boolean = !isBoth

  if (isBoth || isOnlyInfra || isNone) {
    finalData.push(
      await basedClient
        .call(context.endpoints.LOGS_CLUSTER, {
          cluster,
          org,
          env,
          project,
        })
        .get(),
    )
  }

  if (isBoth || isOnlyApp || isNone) {
    finalData.push(await basedClient.call(context.endpoints.LOGS_ENV).get())
  }

  renderData(finalData.flat())
}

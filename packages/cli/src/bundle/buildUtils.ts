import { BuildContext, BuildResult } from 'esbuild'

export type BuildCtx = {
  ctx: BuildContext
  build: BuildResult
}

export const rebuild = async (ctx: BuildContext): Promise<BuildCtx> => {
  const build = await ctx.rebuild()
  return { ctx, build }
}

export const evalBuild = async (build: BuildResult) =>
  (
    await import(
      `data:text/javascript;base64,${Buffer.from(build.outputFiles[0].contents).toString('base64')}`
    ).catch((err) => {
      console.log('err?', err.message)
      return {}
    })
  ).default

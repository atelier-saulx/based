import { BuildContext, BuildResult } from 'esbuild'
import { Module } from 'node:module'

export type BuildCtx = {
  ctx: BuildContext
  build: BuildResult
}

export const rebuild = async (ctx: BuildContext): Promise<BuildCtx> => {
  const build = await ctx.rebuild()
  return { ctx, build }
}

export const importFromBuild = (build: BuildResult, filename: string) => {
  const code = Buffer.from(build.outputFiles[0].contents).toString('utf8')

  const m = new Module(filename)
  // @ts-ignore
  m._compile(code, filename)
  return m.exports.default
}

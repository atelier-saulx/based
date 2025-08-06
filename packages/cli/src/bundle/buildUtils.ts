import { BuildContext, BuildResult } from 'esbuild'
import { Module } from 'node:module'
import path from 'node:path'

export type BuildCtx = {
  ctx: BuildContext
  build: BuildResult
}

export const rebuild = async (ctx: BuildContext): Promise<BuildCtx> => {
  const build = await ctx.rebuild()
  return { ctx, build }
}

export const evalBuild = async (build: BuildResult, path: string) =>
  (
    await import(
      `data:text/javascript;base64,${Buffer.from(build.outputFiles[0].contents).toString('base64')}?base=${encodeURIComponent(path)}`
    ).catch((err) => {
      console.log('err?', err.message)
      return {}
    })
  ).default

export const importFromBuild = (build: BuildResult, filename: string) => {
  const code = Buffer.from(build.outputFiles[0].contents).toString('utf8')

  const m = new Module(filename)
  // @ts-ignore
  m._compile(code, filename)
  return m.exports.default
}

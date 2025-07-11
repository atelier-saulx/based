import { findUp } from 'find-up'
import { context } from 'esbuild'
import { readJSON } from 'fs-extra/esm'

export const getBasedConfig = async () => {
  const basedFile = await findUp(['based.ts', 'based.js', 'based.json'])

  if (basedFile) {
    if (/\.(?:ts|js)$/.test(basedFile)) {
      const basedConfigCtx = await context({
        entryPoints: [basedFile],
        bundle: true,
        write: false,
        platform: 'node',
        metafile: true,
      }).then(async (ctx) => {
        const build = await ctx.rebuild()
        return { ctx, build }
      })
      console.dir(basedConfigCtx)
      const config = eval(basedConfigCtx.build.outputFiles[0].text)
      return config
    } else {
      return readJSON(basedFile)
    }
  }
}

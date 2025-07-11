import { findUp } from 'find-up'
import { build, BuildResult, context } from 'esbuild'
import { readJSON } from 'fs-extra/esm'

export const getBasedConfig = async () => {
  const basedFile = await findUp(['based.ts', 'based.js', 'based.json'])

  if (basedFile) {
    if (/\.(?:ts|js)$/.test(basedFile)) {
      try {
        const basedConfigCtx = await build({
          entryPoints: [basedFile],
          bundle: true,
          write: false,
          platform: 'node',
          metafile: true,
        })
        const code = basedConfigCtx.outputFiles[0].text
        console.log(code)
        const config = eval(code)
        console.log(config)
        return config
      } catch (error) {
        console.error(error)
      }
    } else {
      return readJSON(basedFile)
    }
  }
}

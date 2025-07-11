import { findUp } from 'find-up'
import { build } from 'esbuild'
import { readJSON } from 'fs-extra/esm'

export const getBasedConfig = async () => {
  const basedFile = await findUp(['based.ts', 'based.js', 'based.json'])

  if (!basedFile) {
    console.info('no based file')
    process.exit()
  }

  if (/\.(?:ts|js)$/.test(basedFile)) {
    try {
      const basedConfigCtx = await build({
        entryPoints: [basedFile],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'esm',
      })
      const config = await import(
        `data:text/javascript;base64,${Buffer.from(basedConfigCtx.outputFiles[0].contents).toString('base64')}`
      )
      console.log(config.default)
      return config.default
    } catch (error) {
      console.error(error)
    }
  } else {
    return readJSON(basedFile)
  }
}

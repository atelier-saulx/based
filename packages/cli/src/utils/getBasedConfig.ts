import { findUp } from 'find-up'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { BasedOpts } from '@based/client'

export const getBasedConfig = async (): Promise<BasedOpts> => {
  const basedFile = await findUp(['based.ts', 'based.js', 'based.json'])

  if (!basedFile) {
    console.info('No based file found')
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
      return config.default
    } catch (error) {
      console.error(error)
    }
  } else {
    return JSON.parse(await readFile(basedFile, 'utf-8'))
  }
}

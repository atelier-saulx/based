import { findUp } from 'find-up'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { BasedOpts } from '@based/client'
import { Opts } from '../../types.js'

export const getBasedConfig = async (opts: Opts): Promise<BasedOpts> => {
  const basedFile = await findUp(['based.ts', 'based.js', 'based.json'])

  if (!basedFile) {
    if (opts.org && opts.project && opts.env) {
      return {
        org: opts.org,
        project: opts.project,
        env: opts.env,
        cluster: opts.cluster,
      }
    }
    throw new Error('Based file not found')
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
      const { default: config } = await import(
        `data:text/javascript;base64,${Buffer.from(basedConfigCtx.outputFiles[0].contents).toString('base64')}`
      )

      if (opts.org) {
        config.org = opts.org
      }

      if (opts.project) {
        config.project = opts.project
      }
      if (opts.env) {
        config.env = opts.env
      }

      if (opts.cluster) {
        config.cluster = opts.cluster
      }

      return config
    } catch (error) {
      throw error
    }
  } else {
    return JSON.parse(await readFile(basedFile, 'utf-8'))
  }
}

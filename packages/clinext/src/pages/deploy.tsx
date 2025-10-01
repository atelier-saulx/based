import { BasedClient } from '@based/client'
import { Box, Text, useApp } from 'ink'
import React, { useEffect } from 'react'
import { parseFolder, ParseResults } from '../bundle/parse.js'
import { serialize } from '@based/schema'
import { basename, join, relative, resolve } from 'path'
import type { OutputFile } from 'esbuild'
import { hash } from '@based/hash'
import { useClient } from '@based/react'

export const deployChanges = async (
  client: BasedClient,
  publicPath: string,
  changes: ParseResults,
) => {
  // Set schemas
  if (changes.schema) {
    const schemas = Array.isArray(changes.schema.schema)
      ? changes.schema.schema
      : [{ db: 'default', schema: changes.schema.schema }]
    await Promise.allSettled(
      schemas.map((schema) => client.call('db:set-schema', serialize(schema))),
    )
  }

  // Upload assets
  const uploaded = new Set<OutputFile>()
  const favicons = new Set<OutputFile>()
  await Promise.allSettled(
    changes.configs.map((config) => {
      if (config.fnConfig.type !== 'app' || !config.mainCtx) {
        return
      }

      const favicon =
        config.fnConfig.favicon &&
        relative(changes.cwd, join(config.dir, config.fnConfig.favicon))

      return Promise.allSettled(
        config.mainCtx.build.outputFiles.map(async (file) => {
          const relPath = relative(changes.cwd, file.path)
          if (
            favicon in config.mainCtx.build.metafile.outputs[relPath].inputs
          ) {
            if (file.path.endsWith('.js')) {
              return
            }
            favicons.add(file)
          }
          await client.stream('db:file-upload', {
            contents: file.contents,
            payload: {
              Key: basename(file.path),
            },
          })
          uploaded.add(file)
        }),
      )
    }),
  )

  // Deploy functions
  await Promise.all(
    changes.configs.map((config) => {
      const payload: any = {
        config: config.fnConfig,
      }

      if (config.fnConfig.type === 'app') {
        if (!config.mainCtx) {
          return
        }
        const jsFile = config.mainCtx.build.outputFiles.find((file) =>
          file.path.endsWith('.js'),
        )
        const cssFile = config.mainCtx.build.outputFiles.find((file) =>
          file.path.endsWith('.css'),
        )
        const faviconFile =
          config.fnConfig.favicon &&
          config.mainCtx.build.outputFiles.find((file) => favicons.has(file))

        if (jsFile) {
          payload.config.js = publicPath + basename(jsFile.path)
        }
        if (cssFile) {
          payload.config.css = publicPath + basename(cssFile.path)
        }
        if (faviconFile) {
          payload.config.favicon = publicPath + basename(faviconFile.path)
        }
      }

      payload.checksum = hash(payload)

      return client
        .stream('based:set-function', {
          contents: config.indexCtx.build.outputFiles[0].contents,
          payload,
        })
        .catch((err) => {
          console.error(
            'Error deploying function:',
            config.fnConfig,
            err.message,
            config.indexCtx.build.outputFiles[0].contents.byteLength,
          )
        })
    }),
  )
}

export const Deploy = ({ opts }) => {
  const client = useClient()
  const { exit } = useApp()

  useEffect(() => {
    const run = async () => {
      const cwd = process.cwd()
      const { publicPath, version = 1 } = await client.call('based:env-info')
      if (version === 1) {
        console.error('This env is not compatible with this cli')
      } else {
        const results = await parseFolder({
          opts,
          cwd,
          publicPath,
        })
        await deployChanges(client, publicPath, results)
      }
      exit()
    }
    run()
  }, [])

  return (
    <Box>
      <Text>Deploy time!</Text>
    </Box>
  )
}

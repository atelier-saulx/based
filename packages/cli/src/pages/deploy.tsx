import { BasedClient } from '@based/client'
import { Box, Text } from 'ink'
import React, { useEffect } from 'react'
import { parseFolder, ParseResults } from '../bundle/parse.js'
import { serialize } from '@based/schema'
import { basename } from 'path'

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
  await Promise.all(
    changes.configs.map((config) => {
      if (!config.mainCtx) return
      return Promise.all(
        config.mainCtx.build.outputFiles.map((file) =>
          client.stream('db:file-upload', {
            contents: file.contents,
            payload: {
              Key: basename(file.path),
            },
          }),
        ),
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
        if (jsFile) {
          payload.config.js = publicPath + basename(jsFile.path)
        }
        if (cssFile) {
          payload.config.css = publicPath + basename(cssFile.path)
        }
      }

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
  useEffect(() => {
    const run = async () => {
      const cwd = process.cwd()
      const results = await parseFolder({
        opts,
        cwd,
        publicPath: 'xxx',
      })
    }
    run()
  }, [])

  return (
    <Box>
      <Text>Deploy time!</Text>
    </Box>
  )
}

import { Box, Text } from 'ink'
import React, { useEffect } from 'react'
import { parseFolder, watch } from './bundle/index.js'
import { initS3 } from '@based/s3'
import start from '@based/hub'
import connect from '@based/client'
import { basename } from 'path'
import handler from 'serve-handler'
import http from 'http'
import { serialize } from '@based/schema'
import { ParseResults } from './bundle/parse.js'

const startFileServer = (port: number, path: string) => {
  const headers = [
    {
      source: '*',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
      ],
    },
  ]

  return http
    .createServer((request, response) => {
      return handler(request, response, {
        public: path,
        headers,
      })
    })
    .listen(port, () => {
      console.info('File server: http://localhost:' + port)
    })
}

export const Dev = () => {
  useEffect(() => {
    const run = async () => {
      const filePort = 8082
      const publicPath = `http://localhost:${filePort}/`
      const results = await parseFolder({
        cwd: process.cwd(),
        publicPath,
      })

      startFileServer(filePort, './tmp/files')

      await start({
        port: 8080,
        path: './tmp',
        s3: initS3({
          provider: 'local',
          localS3Dir: './tmp',
        }),
        buckets: {
          files: 'files',
          backups: 'backups',
          dists: 'dists', // not used?
        },
      })

      const client = connect({
        url: 'ws://localhost:8080',
      })

      const deployChanges = async (changes: ParseResults) => {
        // set schemas
        if (changes.schema) {
          const schemas = Array.isArray(changes.schema.schema)
            ? changes.schema.schema
            : [{ db: 'default', schema: changes.schema.schema }]
          await Promise.all(
            schemas.map((schema) => {
              return client.call('db:set-schema', serialize(schema))
            }),
          )
        }

        // upload assets
        await Promise.all(
          changes.configs.map((config) => {
            if (!config.mainCtx) return
            return Promise.all(
              config.mainCtx?.build.outputFiles.map((file) => {
                return client.stream('db:file-upload', {
                  contents: file.contents,
                  payload: {
                    Key: basename(file.path),
                  },
                })
              }),
            )
          }),
        )

        // deploy functions
        await Promise.all(
          changes.configs.map((config) => {
            const payload: any = {
              config: config.fnConfig,
            }

            if (config.fnConfig.type === 'app') {
              payload.config.js =
                publicPath +
                basename(
                  config.mainCtx.build.outputFiles.find((file) =>
                    file.path.endsWith('.js'),
                  ).path,
                )
              payload.config.css =
                publicPath +
                basename(
                  config.mainCtx.build.outputFiles.find((file) =>
                    file.path.endsWith('.css'),
                  ).path,
                )
            }

            return client.stream('based:set-function', {
              contents: config.indexCtx.build.outputFiles[0].contents,
              payload,
            })
          }),
        )
      }

      await deployChanges(results)
      await watch(results, (err, changes) => {
        if (err) {
          console.error('error watching', err)
        }
        if (changes) {
          console.log('changed stuff', changes)
          deployChanges(changes)
        }
      })
    }
    run()
  }, [])

  return (
    <Box>
      <Text>Dev time!</Text>
    </Box>
  )
}

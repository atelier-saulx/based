import { Box, Text } from 'ink'
import React, { useEffect } from 'react'
import { parseFolder, watch } from './bundle/index.js'
import { initS3 } from '@based/s3'
import start from '@based/hub'
import connect from '@based/client'
import { basename, dirname, join } from 'path'
import handler from 'serve-handler'
import http from 'http'
import { serialize } from '@based/schema'

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

      // set schemas
      if (results.schema) {
        const schemas = Array.isArray(results.schema.schema)
          ? results.schema.schema
          : [{ db: 'default', schema: results.schema.schema }]
        await Promise.all(
          schemas.map((schema) => {
            return client.call('db:set-schema', serialize(schema))
          }),
        )
      }
      // console.log('schemas', results.schema.schema)
      // await Promise.all(
      // results.schema.map((schema) => {
      // )
      // await client.call(
      //   'db:set-schema',
      //   serialize({
      //     db: 'default',
      //     schema: defaultSchema,
      //   }),
      // )

      // upload assets
      await Promise.all(
        results.configs.map((config) => {
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
        results.configs.map((config) => {
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

      await watch(results, (err, path, type) => {
        console.log('change!', err, path, type)
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

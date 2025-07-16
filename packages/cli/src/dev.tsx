import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { parseFolder, watch } from './bundle/index.js'
import { initS3 } from '@based/s3'
import start from '@based/hub'
import connect from '@based/client'
import { basename } from 'path'
import handler from 'serve-handler'
import http from 'http'
import { serialize } from '@based/schema'
import { ParseResults } from './bundle/parse.js'

const FILE_PORT = 8082
const HUB_PORT = 8080
const TMP_PATH = './tmp'
const FILES_PATH = `${TMP_PATH}/files`

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
      console.info(`File server: http://localhost:${port}`)
    })
}

const deployChanges = async (
  client: ReturnType<typeof connect>,
  publicPath: string,
  changes: ParseResults,
) => {
  // Set schemas
  if (changes.schema) {
    const schemas = Array.isArray(changes.schema.schema)
      ? changes.schema.schema
      : [{ db: 'default', schema: changes.schema.schema }]
    await Promise.all(
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

      if (config.fnConfig.type === 'app' && config.mainCtx) {
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

      return client.stream('based:set-function', {
        contents: config.indexCtx.build.outputFiles[0].contents,
        payload,
      })
    }),
  )
}

export const Dev = () => {
  useEffect(() => {
    const run = async () => {
      const publicPath = `http://localhost:${FILE_PORT}/`
      const cwd = process.cwd()
      const results = await parseFolder({
        cwd,
        publicPath,
      })

      startFileServer(FILE_PORT, FILES_PATH)

      await start({
        port: HUB_PORT,
        path: TMP_PATH,
        s3: initS3({
          provider: 'local',
          localS3Dir: TMP_PATH,
        }),
        buckets: {
          files: 'files',
          backups: 'backups',
          dists: 'dists',
        },
      })

      const client = connect({
        url: `ws://localhost:${HUB_PORT}`,
      })

      await deployChanges(client, publicPath, results)

      await watch(results, async (err, changes) => {
        if (err) {
          console.error('Error watching:', err)
          return
        }
        if (changes) {
          console.log('Detected changes, deploying...')
          await deployChanges(client, publicPath, changes)
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

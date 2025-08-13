import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { parseFolder, watch } from '../bundle/index.js'
import { initS3 } from '@based/s3'
import startHub from '@based/hub'
import connect from '@based/client'
import handler from 'serve-handler'
import http from 'http'
import { deployChanges } from './deploy.js'
import getPort from 'get-port'

const TMP_PATH = './tmp'
const FILES_PATH = `${TMP_PATH}/files`

const startFileServer = (port: number, path: string) => {
  return http
    .createServer((req, res) => {
      handler(req, res, {
        public: path,
        headers: [
          {
            source: '*',
            headers: [
              {
                key: 'Access-Control-Allow-Origin',
                value: '*',
              },
            ],
          },
        ],
      })
    })
    .listen(port, () => {
      console.info(`File server running at http://localhost:${port}`)
    })
}

export const Dev = ({ opts }) => {
  useEffect(() => {
    const run = async () => {
      try {
        const filePort = await getPort({ port: 8080 })
        const server = startFileServer(filePort, FILES_PATH)
        const publicPath = `http://localhost:${filePort}/`
        const cwd = process.cwd()
        const hubPort = await getPort({ port: 1234 })

        opts.url = `ws://localhost:${hubPort}`

        const results = await parseFolder({ opts, cwd, publicPath })
        const hub = await startHub({
          port: hubPort,
          path: TMP_PATH,
          s3: initS3({
            provider: 'local',
            localS3Dir: TMP_PATH,
          }),
          buckets: {
            files: 'files',
            backups: 'backups',
            dists: 'dists', // deprecated
          },
        })

        const client = connect({ url: opts.url })
        await client.setAuthState({ token: 'local', type: 'based' })
        await deployChanges(client, publicPath, results)
        await watch(results, async (err, changes) => {
          if (err) {
            console.error('Error watching:', err)
            return
          }
          if (changes) {
            console.log('Detected changes, deploying...')
            await deployChanges(client, publicPath, changes)
            console.log('DONE')
            hub.server.forceReload()
          }
        })
      } catch (err) {
        console.error('Dev server error:', err)
      }
    }
    run()
  }, [])

  return (
    <Box>
      <Text>Dev time!</Text>
    </Box>
  )
}

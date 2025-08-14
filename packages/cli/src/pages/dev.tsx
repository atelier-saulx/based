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
import MailDev from 'maildev'
import mailDevLogger from 'maildev/lib/logger.js'
import colors from 'picocolors'
import { networkInterfaces } from 'os'

const TMP_PATH = './tmp'
const FILES_PATH = `${TMP_PATH}/files`

const startMailServer = (smtpPort: number, webPort: number) => {
  mailDevLogger.setLevel(0)
  console.info(`[mail-stmp] http://localhost:${smtpPort}`)
  console.info(`[mail-ui] http://localhost:${webPort}`)
  return new MailDev({
    smtp: smtpPort,
    web: webPort,
  }).listen()
}

const startFileServer = (port: number, path: string) => {
  console.info(`[file-server] http://localhost:${port}`)
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
    .listen(port)
}

const getMyIp = () => {
  const nets = networkInterfaces()
  const results: Record<string, string[]> = {}

  for (const name in nets) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results[name] ??= []
        results[name].push(net.address)
      }
    }
  }

  let ip = results.en0?.[0]

  if (!ip) {
    for (const k in results) {
      ip = results[k][0]
      if (ip) {
        return ip
      }
    }
  }

  return ip
}

const startEnvServer = (hubPort: number, smtpPort: number) => {
  const domain = `${getMyIp()}:${hubPort}`

  console.info(
    `[env-server] http://localhost:${hubPort} ${colors.gray(`http://${domain}`)}`,
  )
  process.env.DOMAIN = domain

  return startHub({
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
    smtp: {
      auth: { port: smtpPort },
    },
    console: {
      ...console,
      log: (...args) => console.log('[env-server]', ...args),
      warn: (...args) => console.warn('[env-server]', ...args),
      info: (...args) => console.info('[env-server]', ...args),
      error: (...args) => console.error('[env-server]', ...args),
    },
  })
}

export const Dev = ({ opts }) => {
  useEffect(() => {
    const run = async () => {
      try {
        const [filePort, envPort, smtpPort, smtpWebPort] = await Promise.all([
          getPort({ port: 8080 }),
          getPort({ port: 1234 }),
          getPort({ port: 1025 }),
          getPort({ port: 1026 }),
        ])

        startFileServer(filePort, FILES_PATH)
        startMailServer(smtpPort, smtpWebPort)

        const env = await startEnvServer(envPort, smtpPort)
        const url = `ws://localhost:${envPort}`
        const publicPath = `http://localhost:${filePort}/`
        const cwd = process.cwd()
        const results = await parseFolder({
          opts: { ...opts, url },
          cwd,
          publicPath,
        })
        const client = connect({ url })
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
            env.server.forceReload()
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

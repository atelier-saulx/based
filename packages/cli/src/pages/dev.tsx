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

const startMailServer = (ip: string, smtpPort: number, webPort: number) => {
  mailDevLogger.setLevel(0)
  console.info(
    `[mail-stmp] http://localhost:${smtpPort} ${colors.gray(`http://${ip}:${smtpPort}`)}`,
  )
  console.info(
    `[mail-ui] http://localhost:${webPort} ${colors.gray(`http://${ip}:${webPort}`)}`,
  )
  return new MailDev({
    smtp: smtpPort,
    web: webPort,
  }).listen()
}

const startFileServer = (ip: string, port: number, path: string) => {
  console.info(
    `[file-server] http://localhost:${port} ${colors.gray(`http://${ip}:${port}`)}`,
  )
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
  const prefer = nets.en0 || nets.lo0

  for (const net of prefer) {
    if (net.family === 'IPv4' && !net.internal) {
      return net.address
    }
  }

  for (const name in nets) {
    if (prefer === nets[name]) {
      continue
    }
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
}

const startEnvServer = (ip: string, hubPort: number, smtpPort: number) => {
  const domain = `${ip}:${hubPort}`
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
        const ip = getMyIp()
        const [envPort, filePort, smtpWebPort, smtpPort] = await Promise.all([
          getPort({ port: 1234 }),
          getPort({ port: 2000 }),
          getPort({ port: 3000 }),
          getPort({ port: 4000 }),
        ])

        startFileServer(ip, filePort, FILES_PATH)
        startMailServer(ip, smtpPort, smtpWebPort)

        const env = await startEnvServer(ip, envPort, smtpPort)
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

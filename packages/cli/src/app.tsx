import React, { createContext, useEffect, useRef, useState } from 'react'
import { Box, Text } from 'ink'
import { Provider, useClient, useConnected, useAuthState } from '@based/react'
import { getBasedConfig } from './utils/getBasedConfig.js'
import { BasedClient, BasedOpts } from '@based/client'
import { Spinner } from '@inkjs/ui'
import { Opts } from './types.js'
import { Login } from './login.js'
import { AdminCtx } from './adminCtx.js'
import { PERSISTENT_STORAGE } from './constants.js'
import { join } from 'path'
import { mkdir } from 'node:fs/promises'
import { Status } from './status.js'

type Props = {
  opts: Opts
  command: 'dev' | 'deploy' | 'secrets' | 'init' | 'status'
}

const Env = (props: { command: 'dev' | 'deploy' | 'secrets' | 'status' }) => {
  const { connected } = useConnected()
  const { userId, error } = useAuthState()

  if (connected) {
    if (!userId) {
      return <Login />
    }

    if (props.command === 'status') {
      return <Status />
    }

    return <Text color="yellow">Command not implemented! {props.command}</Text>
  }

  return <Spinner label="Connecting" />
}

const EnvWrapper = ({
  command,
  opts,
}: {
  command: 'dev' | 'deploy' | 'secrets' | 'status'
  opts: Opts
}) => {
  const [loadingState, setLoadingState] = useState('loading')
  const client = useRef<BasedClient>(null)
  const adminClient = useRef<BasedClient>(null)

  useEffect(() => {
    getBasedConfig()
      .then(async (config) => {
        await mkdir(join(PERSISTENT_STORAGE, config.cluster, 'env'), {
          recursive: true,
        }).catch((err) => {})
        await mkdir(join(PERSISTENT_STORAGE, config.cluster, 'admin'), {
          recursive: true,
        }).catch((err) => {})

        // env client
        client.current = new BasedClient(
          {
            ...config,
            key: 'cms',
            optionalKey: true,
          },
          {
            persistentStorage: join(PERSISTENT_STORAGE, config.cluster, 'env'),
          },
        )

        // TODO add custom discovery url
        // if (platformDiscoveryUrl) {
        //   opts.discoveryUrls = [platformDiscoveryUrl]
        // }
        adminClient.current = new BasedClient(
          {
            org: 'saulx',
            project: 'based-cloud',
            env: 'platform',
            name: '@based/admin-hub',
            cluster: config.cluster,
          },
          {
            persistentStorage: join(
              PERSISTENT_STORAGE,
              config.cluster,
              'admin',
            ),
          },
        )

        setLoadingState('ready')
      })
      .catch((err) => {
        console.log(err)
        setLoadingState('error')
      })
  }, [])

  if (loadingState === 'loading') {
    return <Text>loading...</Text>
  }

  if (loadingState === 'error') {
    return <Text>Cannot find based config</Text>
  }

  return (
    <AdminCtx.Provider value={adminClient.current}>
      <Provider client={client.current}>
        <Box padding={1}>
          <Env command={command} />
        </Box>
      </Provider>
    </AdminCtx.Provider>
  )
}

const Init = () => {
  return <Text color="cyan">Init will come here</Text>
}

export default function App({ opts, command }: Props) {
  if (command === 'init') {
    return <Init />
  }

  return <EnvWrapper command={command} opts={opts} />
}

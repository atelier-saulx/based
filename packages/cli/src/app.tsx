import React from 'react'
import { Box, Text } from 'ink'
import { Provider, useConnected, useAuthState } from '@based/react'
import { Spinner } from '@inkjs/ui'
import { Login } from './login.js'
import { AdminCtx } from './adminCtx.js'
import { Status } from './status/status.js'
import { Logout } from './logout.js'
import { Dev } from './dev.js'
import { Init } from './init.js'
import { useClients } from './hooks/useClients/useClients.js'
import { Props } from './types.js'

const Env = (p: Props) => {
  const { connected } = useConnected()
  const { userId } = useAuthState()
  if (p.command === 'logout') {
    return <Logout />
  }
  if (connected) {
    if (!userId && !p.opts.noCloud) {
      return <Login />
    }

    if (p.command === 'status') {
      return <Status />
    }

    return <Text color="yellow">Command not implemented! {p.command}</Text>
  }
  return <Spinner label="Connecting" />
}

const EnvWrapper = (p: Props) => {
  const { client, adminClient, loadingState, error } = useClients(p.opts)
  if (error) {
    return <Text>{error.message}</Text>
  }
  if (loadingState === 'loading') {
    return <Text>loading...</Text>
  }
  return (
    <AdminCtx.Provider value={adminClient.current}>
      <Provider client={client.current}>
        <Box padding={1}>
          <Env {...p} />
        </Box>
      </Provider>
    </AdminCtx.Provider>
  )
}

export default function App(p: Props) {
  if (p.command === 'init') {
    // get user orgs
    return <Init />
  }

  if (p.command === 'dev') {
    return <Dev />
  }

  return <EnvWrapper {...p} />
}

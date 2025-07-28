import React from 'react'
import { Text } from 'ink'
import { Provider, useAuthState } from '@based/react'
import { Login } from './pages/login.js'
import { AdminCtx } from './adminCtx.js'
import { Events } from './pages/events.js'
import { Logout } from './pages/logout.js'
import { Dev } from './pages/dev.js'
import { GetSecret, SetSecret } from './pages/secrets.js'
import { Init } from './pages/init.js'
import { useClients } from './hooks/useClients/useClients.js'
import { Props } from './types.js'
import { Deploy } from './pages/deploy.js'

const Env = (p: Props) => {
  const { userId } = useAuthState()
  if (p.command === 'logout') {
    return <Logout />
  }
  if (!userId && !p.opts.noCloud) {
    return <Login />
  }

  if (p.command === 'status') {
    return <Events />
  }

  return <Text color="yellow">Command not implemented! {p.command}</Text>
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
        <Env {...p} />
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

  if (p.command === 'deploy') {
    return <Deploy />
  }

  if (p.command === 'secrets') {
    const subCommand = p.opts.args?.[0]

    if (subCommand === 'get') {
      return <GetSecret name={p.opts.name} />
    } else if (subCommand === 'set') {
      return <SetSecret name={p.opts.name} value={p.opts.value} />
    }
    return <Text>Need to use a subcommand, this should be a help doc</Text>
  }

  return <EnvWrapper {...p} />
}

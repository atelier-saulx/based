import { useClient } from '@based/react'
import { useApp } from 'ink'
import React, { useContext, useEffect } from 'react'
import { AdminCtx } from '../adminCtx.js'
import { Spinner } from '@inkjs/ui'

export const Logout = () => {
  const client = useClient()
  const adminClient = useContext(AdminCtx)
  const { exit } = useApp()

  useEffect(() => {
    Promise.allSettled([
      client.clearStorage(),
      adminClient.clearStorage(),
    ]).then(() => {
      Promise.allSettled([
        client.destroy(true),
        adminClient.destroy(true),
      ]).then(() => {
        setTimeout(() => {
          exit()
        }, 100)
      })
    })
  }, [])

  return <Spinner label="Logging out" />
}

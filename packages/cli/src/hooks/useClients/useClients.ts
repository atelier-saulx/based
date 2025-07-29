import { useRef, useState, useEffect } from 'react'
import { BasedClient } from '@based/client'
import { getBasedConfig } from './getBasedConfig.js'
import { PERSISTENT_STORAGE } from '../../constants.js'
import { join } from 'path'
import { mkdir } from 'node:fs/promises'

export function useClients(opts: any) {
  const [loadingState, setLoadingState] = useState<'loading' | 'ready'>(
    'loading',
  )
  const [error, setError] = useState<Error | null>(null)
  const client = useRef<BasedClient>(null)
  const adminClient = useRef<BasedClient>(null)

  useEffect(() => {
    getBasedConfig(opts)
      .then(async (config) => {
        await Promise.allSettled([
          mkdir(join(PERSISTENT_STORAGE, config.cluster, 'env'), {
            recursive: true,
          }),
          mkdir(join(PERSISTENT_STORAGE, config.cluster, 'admin'), {
            recursive: true,
          }),
        ])

        const discoveryUrls = opts.url ? [opts.url] : undefined

        if (opts.hub) {
          client.current = new BasedClient(
            {
              url: opts.hub,
            },
            {
              persistentStorage: join(
                PERSISTENT_STORAGE,
                config.cluster,
                'env',
              ),
            },
          )
        } else {
          client.current = new BasedClient(
            {
              ...config,
              key: 'cms',
              optionalKey: true,
              discoveryUrls,
            },
            {
              persistentStorage: join(
                PERSISTENT_STORAGE,
                config.cluster,
                'env',
              ),
            },
          )
        }

        if (opts.token) {
          await client.current.setAuthState(opts.token).catch((err) => {
            // console.error(err)
          })
        }

        if (!opts.noCloud) {
          adminClient.current = new BasedClient(
            {
              org: 'saulx',
              project: 'based-cloud',
              env: 'platform',
              name: '@based/admin-hub',
              cluster: config.cluster,
              discoveryUrls,
            },
            {
              persistentStorage: join(
                PERSISTENT_STORAGE,
                config.cluster,
                'admin',
              ),
            },
          )

          // adminClient.current
          //   .query('user-envs', {
          //     userId: adminClient.current.authState.userId,
          //   })
          //   .subscribe((res) => {
          //     console.log(res)
          //   })

          if (opts.token) {
            await adminClient.current.setAuthState(opts.token).catch((err) => {
              // console.error(err)
            })
          }
        }

        setLoadingState('ready')
      })
      .catch((err) => setError(err))
  }, [opts])

  return { client, adminClient, loadingState, error }
}

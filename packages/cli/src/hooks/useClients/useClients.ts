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

        client.current = new BasedClient(
          {
            ...config,
            key: 'cms',
            optionalKey: true,
            discoveryUrls,
          },
          {
            persistentStorage: join(PERSISTENT_STORAGE, config.cluster, 'env'),
          },
        )

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
        }

        setLoadingState('ready')
      })
      .catch((err) => setError(err))
  }, [opts])

  return { client, adminClient, loadingState, error }
}

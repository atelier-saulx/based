import React, { useContext, useState } from 'react'
import { Box, Newline, Text } from 'ink'
import { EmailInput, Spinner } from '@inkjs/ui'
import { useClient } from '@based/react'
import { AdminCtx } from './adminCtx.js'
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator'

export const Login = () => {
  const client = useClient()
  const adminClient = useContext(AdminCtx)
  const [state, setState] = useState<'loading' | 'error' | 'success' | 'start'>(
    'start',
  )
  const [code, setCode] = useState('')

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text>Login to based-cloud cluster</Text>
        <Text color={'blue'}>{client.opts.cluster}</Text>
      </Box>

      <EmailInput
        isDisabled={state !== 'start' && state !== 'error'}
        placeholder="Enter email..."
        onSubmit={(email) => {
          setState('loading')

          const code = uniqueNamesGenerator({
            dictionaries: [adjectives, colors, animals],
            separator: ' ',
            style: 'capital',
          })

          setCode(code)

          adminClient.call('login', { email, code }).catch((err) => {
            setState('error')
            setTimeout(() => {
              setState('start')
            }, 1500)
          })

          adminClient.once('authstate-change', (authState) => {
            if (authState.error) {
              setState('error')
              setTimeout(() => {
                setState('start')
              }, 1500)
            } else {
              setState('success')
              client.setAuthState(authState)
            }
          })
        }}
      />

      {state === 'loading' && (
        <Box gap={1}>
          <Spinner />
          <Text color="gray">Verification email send</Text>
          <Text backgroundColor={'grey'} color={'whiteBright'}>
            {` ${code} `}
          </Text>
        </Box>
      )}
      {state === 'error' && <Text color="red">Error logging in</Text>}
    </Box>
  )
}

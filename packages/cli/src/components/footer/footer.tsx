import { Box, Text } from 'ink'
import React from 'react'
import { useClient, useConnected } from '@based/react'
import { Spinner } from '@inkjs/ui'

export const Footer = (p: { children?: React.ReactNode }) => {
  const client = useClient()
  const opts = client.opts
  const { connected } = useConnected()
  return (
    <Box
      flexGrow={0}
      borderStyle="single"
      borderColor={'gray'}
      justifyContent="space-between"
      paddingLeft={1}
      paddingRight={1}
    >
      <Box>
        <Box marginRight={1} gap={1}>
          {connected ? (
            <Text bold color={'greenBright'}>
              •
            </Text>
          ) : (
            <Text bold color={'grey'}>
              Connecting...
            </Text>
          )}
          <Text bold color={'blueBright'}>
            {opts.cluster ||
              (typeof opts.url === 'string' ? opts.url : 'local')}
          </Text>
        </Box>
        <Text color={'whiteBright'}>{opts.org ? `${opts.org}/` : ''}</Text>
        <Text color={'whiteBright'}>
          {opts.project ? `${opts.project}/` : ''}
        </Text>
        <Text color={'whiteBright'}>{opts.env ? `${opts.env}` : ''}</Text>
      </Box>
      {p.children}
    </Box>
  )
}

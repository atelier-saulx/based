import { Box, Text } from 'ink'
import React from 'react'
import { useClient, useConnected } from '@based/react'
import { Spinner } from '@inkjs/ui'

export const Footer = (p: { children?: React.ReactNode }) => {
  const client = useClient()
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
            <Spinner />
          )}
          <Text bold color={'blueBright'}>
            {client.opts.cluster}
          </Text>
        </Box>
        <Text color={'whiteBright'}>{client.opts.org}/</Text>
        <Text color={'whiteBright'}>{client.opts.project}/</Text>
        <Text color={'whiteBright'}>{client.opts.env}</Text>
      </Box>
      {p.children}
    </Box>
  )
}

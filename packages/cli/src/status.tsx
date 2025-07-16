import { useQuery } from '@based/react'
import { Spinner } from '@inkjs/ui'
import { Box, Text } from 'ink'
import React from 'react'

export const Status = () => {
  const { data, error, loading } = useQuery('based:logs', {})

  if (error) {
    return <Text color="red">{error.message}</Text>
  }

  if (loading) {
    return <Spinner label="Loading logs..." />
  }

  return (
    <Box flexDirection="column">
      <Text>Status</Text>
      <Text>{data.map((log) => log.msg).join('\n')}</Text>
    </Box>
  )
}

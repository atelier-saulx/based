import { useClient, useQuery } from '@based/react'
import { Box, Text } from 'ink'
import React from 'react'

export const Status = () => {
  const logs = useQuery('based:logs', {})

  console.log(logs)
  /*
    before,
      after,
      fn,
      cs,
      lvl,

    */

  return (
    <Box>
      <Text>Status</Text>
    </Box>
  )
}

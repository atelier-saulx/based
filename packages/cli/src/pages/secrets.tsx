import React, { useEffect, useState } from 'react'
import { Text } from 'ink'
import { useClient } from '@based/react'

export const GetSecret = ({ name }) => {
  const client = useClient()
  const [value, setValue] = useState('')
  useEffect(() => {
    client
      .query('based:secret', name)
      .get()
      .then((result) => {
        setValue(result)
      })
  }, [])
  return (
    <Text color="cyan">
      Get secrets {name}: {value}
    </Text>
  )
}

export const SetSecret = ({ name, value }) => {
  const client = useClient()
  const [success, setSucess] = useState(false)
  useEffect(() => {
    client.call('based:set-secret', { name, value }).then((result) => {
      setSucess(true)
    })
  }, [client])
  return <Text color="cyan">Setting secrets {String(success)}</Text>
}

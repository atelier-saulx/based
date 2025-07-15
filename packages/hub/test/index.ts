import { wait } from '@saulx/utils'
import start from '../src'
import connect from '@based/client'

const test = async () => {
  const { services } = await start({
    port: 8080,
    path: './tmp',
  })

  const client = connect({
    url: 'ws://localhost:8080',
  })

  const res = await client.stream('based:set-function', {
    contents: `console.log('hello world!!');export default async () => {console.log('hello function!!');return 'x'}`,
    payload: {
      checksum: 1,
      config: {
        name: 'test',
        type: 'function',
      },
    },
  })

  console.log('????---', res)

  await wait(500)

  const res2 = await client.call('test')
  console.log('res2', res2)
  // await Promise.all(services.map((service) => service.destroy()))
}

test()

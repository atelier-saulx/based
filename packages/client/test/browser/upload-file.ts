import based from '@based/client'
import { join } from 'node:path'

const client = based({
  env: 'framma',
  project: 'test',
  org: 'saulx',
})

const init = async () => {
  console.info('go time')

  try {
    const bla = await client.stream('streamy', {
      path: join(__dirname, '/based.png'),
    })
    console.info(bla)
  } catch (err) {
    console.info(err)
  }
}

init()

import based from '@based/client'
import { join } from 'node:path'
import fs from 'node:fs'

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

  try {
    const bla = await client.stream('streamy', {
      contents: 'blablabla',
      payload: {
        db: 'bla',
      },
    })
    console.info(bla)
  } catch (err) {
    console.info(err)
  }

  try {
    const bla = await client.stream('streamy', {
      contents: fs.readFileSync(join(__dirname, '/based.png')),
      payload: {
        db: 'bla',
      },
    })
    console.info(bla)
  } catch (err) {
    console.info(err)
  }

  console.info('All done!')
}

init()

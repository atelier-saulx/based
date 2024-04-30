import test from 'ava'
import create from '../src/selvad-client/index.js'
import { decodeMessageWithValues } from '../src/selvad-client/proto-value.js';

test.serial.only('ping', async (t) => {
  const db = create(3000, '127.0.0.1')
  try {
    const msg = await db.sendRequest(0, null)
    const resp = decodeMessageWithValues(msg)
    console.dir(resp, { depth: 100 })
  } catch (err) {
      console.log('fail', err)
  }

  t.pass()
})

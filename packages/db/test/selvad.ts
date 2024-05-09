import test from 'ava'
import create from '../src/selvad-client/index.js'
import { decodeMessageWithValues } from '../src/selvad-client/proto-value.js';

test.serial.only('ping', async (t) => {
  const db = create(3000, '127.0.0.1')
  try {
    const seqno = db.newSeqno()
    const [frame] = await db.newFrame(0, seqno)
    const resp = await db.sendFrame(frame, 0, { firstFrame: true, lastFrame: true, batch: false })
    const msg = decodeMessageWithValues(resp)
    console.dir(msg, { depth: 100 })
  } catch (err) {
      console.log('fail', err)
  }

  t.pass()
})

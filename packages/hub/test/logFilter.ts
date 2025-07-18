import { BasedDb } from '@based/db'

const test = async () => {
  const db = new BasedDb({
    path: './tmp',
    maxModifySize: 1e3 * 1e3,
  })
  await db.start({ clean: true })
}

test()

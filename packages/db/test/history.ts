import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import native from '../src/native.js'

await test.skip('history', async (t) => {
  const db = new BasedDb({ path: t.tmp })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
      page: {
        props: {
          name: 'string',
          views: {
            type: 'uint32',
          },
          active: {
            type: 'uint32',
          },
        },
      },
    },
  })

  const pathname = join(t.tmp, 'history')
  const entry = Buffer.from([1, 2, 3])
  writeFileSync(pathname, '')

  native.historyCreate(pathname, entry.byteLength)

  /*
    int selva_history_init(const char *pathname, size_t bsize, struct selva_history **hist_out);
    void selva_history_append(struct selva_history *hist, int64_t ts, node_id_t node_id, void *buf);
    void selva_history_fsync(struct selva_history *hist);
    uint32_t *selva_history_find_range(struct selva_history *hist, int64_t from, int64_t to, size_t *len_out);
    void selva_history_free_range(uint32_t *range);
    void selva_history_destroy(struct selva_history *hist);
    uint32_t *selva_history_find_range_node(struct selva_history *hist, int64_t from, int64_t to, node_id_t node_id, size_t *size_out);
  */

  // await db.putSchema({
  //   types: {
  //     page: {
  //       props: {
  //         name: 'string',
  //         views: {
  //           type: 'uint32',
  //           history: {
  //             interval: 'second'
  //           }
  //         },
  //         active: {
  //           type: 'uint32',
  //           history: {
  //             interval: 'second'
  //           }
  //         }
  //       },
  //     },
  //   },
  // })

  // const page = await db.create('page')
  // let i = 5
  // let views = 0
  // while (i--) {
  //   views++
  //   await db.update('page', page, { views })
  //   await setTimeout(1e3)
  // }

  // throw new Error('ballz')

  // await db.query('page', page).include('views.history')

  // await db.history('page', page).include('views').get()

  /*
  [{
    _ts: 40923740239,
    views: 1
  },
  {
    _ts: 40928040239,
    views: 2
  },
  {
    _ts: 40928040239,
    views: 3
  }]
  */
})

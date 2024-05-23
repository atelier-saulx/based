const db: any = {}
const schema: any = {
  types: {
    article: {
      properties: {
        externalId: {
          type: 'alias',
        },
      },
    },
  },
}

/*
{
  
  attributes: {
    title: 'youzi'
  }
}
*/

setInterval(async () => {
  const allArticles = await fetch('oldShit/allArticles').then((r) => r.json())

  return Promise.all(
    allArticles.map(async ({ uuid, ...props }) => {
      // MAYBE DO THIS?
      // return db.setByAlias(uuid, props)
      return db
        .query('article')
        .filter('externalId', '=', uuid)
        .orCreate('article')
        .set({
          externalId: uuid,
          ...props,
        })

      /*

        const updated = await db
          .query('article')
          .filter('externalId', '=', uuid)
          .set(props)

        if (!updated) {
          return db.create('article', {
            externalId: uuid,
            ...props,
          })
        }
      */
    })
  )
}, 5e3)

db.create('article', {
  externalId: '98sd760d97d',
})

db.query('article').filter('externalId', '=', [
  '98sd760d97d',
  'gs987d',
  'gfd07gd',
])

db.get({
  $alias: 'smurk',
})

db.get({
  things: {
    $list: {
      $find: {
        $traverse: 'descendants',
        $filter: {
          $field: 'aliases',
          $operator: 'has',
          $value: ['98sd760d97d', 'gs987d', 'gfd07gd'],
        },
      },
    },
  },
})

export {}

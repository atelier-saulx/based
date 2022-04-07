export default async ({ based, update }) => {
  const close = await based.observe(
    {
      root: {
        $id: 'root',
        id: true,
      },
      things: {
        name: true,
        $list: {
          $limit: 10e3,
          $find: {
            $traverse: 'descendants',
            $filter: {
              $field: 'type',
              $operator: '=',
              $value: 'thing',
            },
          },
        },
      },
    },
    update
  )
  return close
}

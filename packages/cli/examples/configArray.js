module.exports = [
  {
    db: 'default',
    schema: {
      types: {
        things: {
          fields: {
            name: { type: 'string' },
            createdAt: { type: 'timestamp' },
          },
        },
      },
    },
  },
  // {
  //   db: 'default',
  //   schema: {
  //     types: {
  //       things: {
  //         fields: {
  //           name: { type: 'string' },
  //           createdAt: { type: 'timestamp' },
  //         },
  //       },
  //     },
  //   },
  // },
]

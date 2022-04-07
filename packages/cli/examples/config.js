module.exports = {
  schema: {
    types: {
      thing: {
        fields: {
          name: { type: 'string' },
          cnt: { type: 'number' },
          createdAt: { type: 'timestamp' },
        },
      },
    },
  },
}

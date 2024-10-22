export default {
  appName: 'Based CLI',
  commands: {
    version: {
      parameter: '-v, --version',
    },
    auth: {
      name: 'auth',
      description: 'Authorize your user in the Based Cloud.',
      options: [
        {
          required: false,
          parameter: '--email <email>',
          description: 'To speed up the login process.',
        },
      ],
    },
  },
}

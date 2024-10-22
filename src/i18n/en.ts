export default {
  commands: {
    auth: {
      name: 'auth',
      description: '',
      options: [
        {
          parameter: '--email <email>',
          description: 'To speed up the login process.',
          default: '',
        },
      ],
    },
  },
}

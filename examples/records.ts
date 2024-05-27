const schema = {
  types: {
    org: {
      // DUBAI POLICE
      properties: {
        members: {
          type: 'user',
          list: true,
          edge: {
            properties: {
              roles: {
                type: 'set',
                required: true,
                items: {
                  enum: ['owner', 'developer', 'viewer'],
                },
              },
            },
          },
          inverseProperty: 'memberOf',
        },
        fileFolders: {
          // RECON
          type: 'fileFolder',
          list: true,
          inverseProperty: 'org',
        },
      },
    },

    fileFolder: {
      properties: {
        org: {
          type: 'org',
          inverseProperty: 'fileFolders',
        },
        files: {
          type: 'file',
          inverseProperty: 'fileFolders',
        },
      },
    },

    user: {
      properties: {
        memberOf: {
          type: 'org',
          inverseProperty: 'members',
        },
      },
    },

    file: {
      properties: {
        fileFolders: {
          type: 'fileFolder',
          list: true,
          inverseProperty: 'files',
        },
      },
    },
  },
}

export {}

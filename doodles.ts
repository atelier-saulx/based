import db from '@based/db'

// DECISIONS
// - edge values are both ways
// - expose and, or also on top level
// - call order for filter
// - 1 edge max
// - add required: boolean on edge as well (validation)
// - use properties vs fields
// - bidirectional is only to single field (eg admin => adminOf)
// - no arrays in filter
// - bidirectional => inverseProperty

// PROPOSAL
// - always have properties on edges (no primitives)

// QUESTIONS
// - should we return ALL by default or only ID?

// string filters
// default case insensitive
db.query('myId')
  .include(['id', 'name', 'title'])
  .filter((filter) => {
    // (id === 'bl1234' && body === 'success' || name = 'framma') && bla includes floop
    // note: follow call order (similar to Promise.then/catch)
    return filter('id', '=', 'bl1234')
      .and(['title', 'body'], 'includes', ['youzi', 'olli'])
      .and('body', 'search', 'success')
      .or((filter) => {
        return filter('a', '=', 'b')
      })
      .and('bla', 'includes', 'flloop')
  })
  .and('bla', 'includes', 'flloop')
  .or((filter) => {
    return filter('a', '=', 'b')
  })

// permissions
/*



{
    type: 'user',
    properties: { // formerly fields
        friends: {
            
            type: 'user',
            list: true,
            edge: { // distance
                type: 'number'
            },
            bidirectional: 'friends' // make word final!
            required: true,
        },

        collegues: {
            type: 'user',
            list: true,
            edge: { // strength
                type: 'number'
                required: true,
            }
        }

        user: {
            type: 'user',
            edge: {
                type: 'object',
                properties: {
                    relationType: {
                        enum: ['friend', 'lover', 'collegue']
                    },
                    strength: {
                        type: 'number'
                    }
                }

                type: 'set',
                items: {
                    enum: ['admin', 'developer', 'viewer']
                }
            },
        }
    }
}

youri =(collegue, strength:1 && freidn, strength:1) => framma
*/

// org1 =( role: admin )=> userA
// org2 =( role: developer )=> userA
// org3 =( role: viewer )=> userA

// ONLY ONE EDGE between 2 nodes

// authorize function

/*

{
    edge: {
        properties: {
            // distance: {
            //     type: 'number'
            // },
            role: {
                enum: ['owner', 'developer']
            }
        }
    }
}
{
    types: {

        org: { // DUBAI POLICE
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
                                    enum: [
                                        'owner',
                                        'developer',
                                        'viewer'
                                    ]
                                }
                            }
                        }

                    },
                    inverseProperty: 'memberOf'
                },
                fileFolders: { // RECON
                    type: 'fileFolder',
                    list: true,
                    inverseProperty: 'org'
                }
            }
        },

        fileFolder: {
            properties: {
                org: {
                    type: 'org',
                    bidirectional: 'fileFolders'
                },
                files: {
                    type: 'file',
                    bidirectional: 'fileFolders'
                }
            }
        },

                user: {
            properties: {
                fileFolders: {
                    type: 'fileFolder'
                },
                orgs: {
                    type: 'org'
                }
            }
        },
  
        file: {
            properties: {

                fileFolder: {
                    type: 'fileFolder',
                    bidirectional: 'files'
                }
            }
        },
        ... etc

    }
}
*/

// authorize function
// file upload user upload file, and puts it in fileFolder (cool images)

// userId, fileFolderId, => fileId

/*
{
    fileFolder: {
        properties: {
            randomField: {
                enum: ['a', 'b']
            }
        }
    }
}
*/

db.query('fileFolderIdA').filter('randomField', 'has', 'a').boolean()

// =>
/*
    
*/

db.query('fileFolderIdA')
  // value is on the edge
  .filter('org.members.@userIdB.roles', 'has', ['owner', 'developer'])

  // value is on the user
  .filter('org.members.userIdB.roles', 'has', ['owner', 'developer'])
  .boolean()
//   .filter('org.members[userId]()', 'has', 'userId')

//   .traverse('org.members', () => {
//     .filter('org.members', 'has', 'userId')
//   })

//   .boolean()

// const id = db.set({ type: 'snurp', title:'flap' }, er213213)

// db.set({ type: 'snurp', title:'flap' }, id)

// // const x = db.query(id).context(er213213)

// const id2 = db.set({ type: 'snurp', title:'flap', org: 'er213213' })

// db.query('myId')

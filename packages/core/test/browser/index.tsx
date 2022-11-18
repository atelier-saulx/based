import { BasedCoreClient } from '@based/core-client'

console.info('browser')

const init = async () => {
  const coreClient = new BasedCoreClient()

  coreClient.connect({
    env: 'edge',
    org: 'airhub',
    project: 'airhub',
    // cluster: 'http://localhost:7022',
    // url: async () => {
    //   return 'ws://localhost:9910'
    // },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  console.info('go auth!')

  await coreClient.auth('importservice')

  console.info('hello')
  await coreClient.function('based-db-update-schema', {
    schema: {
      languages: ['en', 'nl', 'de'],
      types: {
        user: {
          prefix: 'us',
          fields: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            avatar: { type: 'reference' },
            email: { type: 'email' },
            lastSessionDate: { type: 'timestamp' },
          },
        },
        team: {
          prefix: 'te',
          fields: { name: { type: 'string' }, avatar: { type: 'reference' } },
        },
        teamMember: {
          prefix: 'tm',
          fields: {
            roles: { type: 'array', items: { type: 'string' } },
            status: { type: 'string' },
          },
        },
        flight: {
          prefix: 'fl',
          fields: {
            address: { type: 'string' },
            createdAt: { type: 'timestamp' },
            takeOffTime: { type: 'timestamp' },
            endTime: { type: 'timestamp' },
            flightHeight: { type: 'int' },
            flightTime: { type: 'int' },
            draft: { type: 'boolean' },
            location: {
              type: 'object',
              properties: { lat: { type: 'float' }, lon: { type: 'float' } },
            },
            name: { type: 'string' },
            note: { type: 'string' },
            flightType: { type: 'string' },
            losType: { type: 'string' },
            pilot: { type: 'reference' },
            batteryCharges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  startPercentage: { type: 'float' },
                  endPercentage: { type: 'float' },
                  id: { type: 'string' },
                },
              },
            },
            observers: { type: 'references' },
            payloadOperators: { type: 'references' },
            batteries: { type: 'references' },
            drone: { type: 'reference' },
            groundStation: { type: 'reference' },
            equipment: { type: 'references' },
            takeOffWeather: {
              type: 'object',
              properties: {
                humidity: { type: 'float' },
                pressure: { type: 'float' },
                temperature: { type: 'float' },
                visibility: { type: 'float' },
                windBearing: { type: 'float' },
                windGusting: { type: 'float' },
                windSpeed: { type: 'float' },
                kpIndex: { type: 'int' },
                gpsAccuracy: { type: 'float' },
                cloudCover: { type: 'float' },
                time: { type: 'timestamp' },
                condition: { type: 'string' },
                sunrise: { type: 'timestamp' },
                sunset: { type: 'timestamp' },
                precipitation: {
                  type: 'object',
                  properties: {
                    intensity: { type: 'float' },
                    accumulation: { type: 'float' },
                    probability: { type: 'float' },
                  },
                },
              },
            },
            permissionForm: {
              type: 'object',
              properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                reason: { type: 'string' },
                signature: { type: 'reference' },
              },
            },
            regulationSet: {
              type: 'object',
              properties: {
                airspaceProvider: { type: 'string' },
                regulations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      details: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            text: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            telemetry: {
              type: 'object',
              properties: {
                satellites: { type: 'int' },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'float' },
                    lon: { type: 'float' },
                    alt: { type: 'float' },
                  },
                },
                attitude: {
                  type: 'object',
                  properties: {
                    pitch: { type: 'float' },
                    roll: { type: 'float' },
                    yaw: { type: 'float' },
                  },
                },
                batteries: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      percentage: { type: 'float' },
                      id: { type: 'string' },
                    },
                  },
                },
                gimbal: {
                  type: 'object',
                  properties: {
                    attitude: {
                      type: 'object',
                      properties: {
                        pitch: { type: 'float' },
                        roll: { type: 'float' },
                        yaw: { type: 'float' },
                      },
                    },
                  },
                },
                datetime: { type: 'timestamp' },
              },
            },
            state: {
              type: 'object',
              properties: {
                datetime: { type: 'timestamp' },
                droneState: { type: 'string' },
                currentAction: { type: 'string' },
                actions: {
                  type: 'object',
                  properties: {
                    hold: { type: 'boolean' },
                    returnToHome: { type: 'boolean' },
                    takeManualControl: { type: 'boolean' },
                    manualControl: { type: 'boolean' },
                    waypointMission: { type: 'boolean' },
                    takeOff: { type: 'boolean' },
                    confirmReady: { type: 'boolean' },
                    rotateGimbal: { type: 'boolean' },
                  },
                },
              },
            },
            commands: { type: 'json' },
            geofence: { type: 'json' },
            mission: { type: 'reference' },
            capabilities: { type: 'json' },
          },
        },
        flightTemplate: {
          prefix: 'ft',
          fields: {
            address: { type: 'string' },
            createdAt: { type: 'timestamp' },
            flightHeight: { type: 'int' },
            location: {
              type: 'object',
              properties: { lat: { type: 'float' }, lon: { type: 'float' } },
            },
            name: { type: 'string' },
            note: { type: 'string' },
            flightType: { type: 'string' },
            losType: { type: 'string' },
            pilot: { type: 'reference' },
            observers: { type: 'references' },
            payloadOperators: { type: 'references' },
            batteries: { type: 'references' },
            drone: { type: 'reference' },
            groundStation: { type: 'reference' },
            equipment: { type: 'references' },
            permissionForm: {
              type: 'object',
              properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                reason: { type: 'string' },
                signature: { type: 'reference' },
              },
            },
            geofence: { type: 'json' },
          },
        },
        battery: {
          prefix: 'ba',
          fields: {
            avatar: { type: 'reference' },
            lastCharged: { type: 'timestamp' },
            manufacturer: { type: 'string' },
            model: { type: 'string' },
            name: { type: 'string' },
            serial: { type: 'string' },
            weight: { type: 'float' },
            firmwareVersion: { type: 'string' },
            status: { type: 'string' },
          },
        },
        equipment: {
          prefix: 'eq',
          fields: {
            name: { type: 'string' },
            manufacturer: { type: 'string' },
            model: { type: 'string' },
            serialNumber: { type: 'string' },
            hardwareVersion: { type: 'string' },
            firmwareVersion: { type: 'string' },
            weight: { type: 'float' },
            purchasedAt: { type: 'timestamp' },
            avatar: { type: 'reference' },
            status: { type: 'string' },
          },
        },
        drone: {
          prefix: 'dr',
          fields: {
            manufacturer: { type: 'string' },
            model: { type: 'string' },
            registration: { type: 'string' },
            serial: { type: 'string' },
            avatar: { type: 'reference' },
            weight: { type: 'float' },
            firmwareVersion: { type: 'string' },
            status: { type: 'string' },
            name: { type: 'string' },
          },
        },
        incident: {
          prefix: 'in',
          fields: {
            incidentType: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            investigator: { type: 'string' },
            flightPhase: { type: 'string' },
            status: { type: 'string' },
            reportedAt: { type: 'timestamp' },
            hazardPreviousCausedAccident: { type: 'boolean' },
            consequences: { type: 'string' },
            proposedMeasures: { type: 'string' },
            reporter: { type: 'reference' },
          },
        },
        incidentFollowUp: {
          prefix: 'fo',
          fields: {
            description: { type: 'string' },
            createdAt: { type: 'timestamp' },
            reporter: { type: 'reference' },
          },
        },
        maintenance: {
          prefix: 'ma',
          fields: {
            date: { type: 'timestamp' },
            inspectionName: { type: 'string' },
            notes: { type: 'string' },
            status: { type: 'string' },
            technicianName: { type: 'string' },
            completionDate: { type: 'timestamp' },
            costs: {
              type: 'object',
              properties: {
                amount: { type: 'float' },
                currencyIsoCode: { type: 'string' },
              },
            },
          },
        },
        checklist: {
          prefix: 'ch',
          fields: {
            createdAt: { type: 'timestamp' },
            name: { type: 'string' },
            purpose: { type: 'string' },
            checklistType: { type: 'string' },
            updatedAt: { type: 'timestamp' },
            updatedBy: { type: 'reference' },
            createdBy: { type: 'reference' },
          },
        },
        checklistItem: {
          prefix: 'ci',
          fields: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
        executedChecklist: {
          prefix: 'ec',
          fields: {
            executedAt: { type: 'timestamp' },
            name: { type: 'string' },
            purpose: { type: 'string' },
            checklistType: { type: 'string' },
            executedBy: { type: 'reference' },
            completed: { type: 'boolean' },
          },
        },
        executedChecklistItem: {
          prefix: 'ei',
          fields: {
            title: { type: 'string' },
            description: { type: 'string' },
            isChecked: { type: 'boolean' },
          },
        },
        document: {
          prefix: 'do',
          fields: {
            name: { type: 'string' },
            file: { type: 'reference' },
            expirationDate: { type: 'timestamp' },
            internal: { type: 'boolean' },
          },
        },
        photo: {
          prefix: 'ph',
          fields: { name: { type: 'string' }, file: { type: 'reference' } },
        },
        activity: {
          prefix: 'ac',
          fields: {
            performedAt: { type: 'timestamp' },
            initiator: { type: 'reference' },
            actionType: { type: 'string' },
            params: { type: 'json' },
          },
        },
        contact: {
          prefix: 'co',
          fields: {
            createdAt: { type: 'timestamp' },
            initiator: { type: 'reference' },
            message: { type: 'string' },
            read: { type: 'boolean' },
            responded: { type: 'boolean' },
          },
        },
        apiAccess: {
          prefix: 'aa',
          fields: {
            createdAt: { type: 'timestamp' },
            expiresAt: { type: 'timestamp' },
            token: { type: 'string' },
            features: { type: 'array', items: { type: 'string' } },
            revoked: { type: 'boolean' },
          },
        },
        refreshToken: {
          prefix: 'rt',
          fields: {
            createdAt: { type: 'timestamp' },
            expiresAt: { type: 'timestamp' },
            token: { type: 'string' },
          },
        },
        pushToken: {
          prefix: 'pt',
          fields: {
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
            token: { type: 'string' },
          },
        },
        notification: {
          prefix: 'no',
          fields: {
            read: { type: 'boolean' },
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
            asset: { type: 'reference' },
            sentiment: { type: 'string' },
            notificationType: { type: 'number' },
            notificationTypeStr: { type: 'string' },
            title: { type: 'text' },
            body: { type: 'text' },
          },
        },
        role: { prefix: 'rl', fields: { name: { type: 'string' } } },
        subscription: {
          prefix: 'ss',
          fields: {
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
            startedAt: { type: 'timestamp' },
            endsAt: { type: 'timestamp' },
          },
        },
        media: {
          prefix: 'me',
          fields: {
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
            file: { type: 'reference' },
            address: { type: 'string' },
            attitude: {
              type: 'object',
              properties: {
                pitch: { type: 'float' },
                roll: { type: 'float' },
                yaw: { type: 'float' },
              },
            },
            location: {
              type: 'object',
              properties: {
                lat: { type: 'float' },
                lon: { type: 'float' },
                alt: { type: 'float' },
              },
            },
            size: { type: 'int' },
            mediaType: { type: 'string' },
          },
        },
        groundStation: {
          prefix: 'gs',
          fields: {
            online: { type: 'boolean' },
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
            lastSeenAt: { type: 'timestamp' },
            name: { type: 'string' },
            location: {
              type: 'object',
              properties: {
                lat: { type: 'float' },
                lon: { type: 'float' },
                alt: { type: 'float' },
              },
            },
            platformType: { type: 'string' },
            remoteId: { type: 'string' },
            geofence: { type: 'json' },
            drones: { type: 'references' },
            credentials: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                password: { type: 'string' },
                address: { type: 'string' },
              },
            },
            streamingConfig: {
              type: 'object',
              properties: { address: { type: 'string' } },
            },
            capabilities: { type: 'json' },
          },
        },
        waypointMission: {
          prefix: 'wm',
          fields: {
            missionType: { type: 'string' },
            waypoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  location: {
                    type: 'object',
                    properties: {
                      lat: { type: 'float' },
                      lon: { type: 'float' },
                      alt: { type: 'float' },
                    },
                  },
                  waypointType: { type: 'string' },
                  holdingTime: { type: 'int' },
                  speed: { type: 'float' },
                  heading: { type: 'float' },
                },
              },
            },
          },
        },
        videoStream: {
          prefix: 'vs',
          fields: {
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
            videoStreamType: { type: 'string' },
            externalId: { type: 'string' },
            flowing: { type: 'boolean' },
            finished: { type: 'boolean' },
            masterService: { type: 'string' },
            masterTick: { type: 'number' },
            cameras: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ip: { type: 'string' },
                  port: { type: 'number' },
                  rtpId: { type: 'string' },
                  webrtcHubPortId: { type: 'string' },
                },
              },
            },
          },
        },
        capabilitiesTemplate: {
          prefix: 'ct',
          fields: {
            name: { type: 'string' },
            capabilities: { type: 'json' },
            public: { type: 'boolean' },
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
          },
        },
        training: {
          prefix: 'tr',
          fields: {
            createdBy: { type: 'reference' },
            createdAt: { type: 'timestamp' },
            team: { type: 'reference' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            roles: { type: 'array', items: { type: 'string' } },
            recurring: { type: 'boolean' },
            frequency: { type: 'int' },
            attachments: { type: 'references' },
          },
        },
        trainingCompletionRequest: {
          prefix: 'tq',
          fields: {
            createdBy: { type: 'reference' },
            training: { type: 'reference' },
            createdAt: { type: 'timestamp' },
            description: { type: 'string' },
            attachments: { type: 'references' },
            reviewed: { type: 'boolean' },
          },
        },
        trainingCompletion: {
          prefix: 'tc',
          fields: {
            createdBy: { type: 'reference' },
            training: { type: 'reference' },
            trainee: { type: 'reference' },
            completionRequest: { type: 'reference' },
            createdAt: { type: 'timestamp' },
            approved: { type: 'boolean' },
            level: { type: 'int' },
            notes: { type: 'string' },
          },
        },
        error: {
          prefix: 'er',
          fields: {
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
            message: { type: 'text' },
            dismissed: { type: 'boolean' },
            read: { type: 'boolean' },
          },
        },
        tag: {
          prefix: 'ta',
          fields: {
            name: { type: 'string' },
            createdAt: { type: 'timestamp' },
            updatedAt: { type: 'timestamp' },
          },
        },
      },
    },
  })

  console.info('hello!!! updated')

  await coreClient.auth('myblurf')

  // coreClient.observe(
  //   'based-db-observe',
  //   (d) => {
  //     console.info('|-->', d)
  //   },
  //   { children: { name: true, id: true, $list: true } }
  // )

  // coreClient.observe(
  //   'nestedCounter',
  //   (d) => {
  //     console.info('NESTED, INCOMING ---->', d)
  //   },
  //   { children: { name: true, id: true, $list: true } }
  // )

  // coreClient.observe(
  //   'nestedCounter',
  //   (d) => {
  //     console.info('NESTED, INCOMING ---->', d)
  //   },
  //   { children: true }
  // )

  // for (let i = 0; i < 5; i++) {
  //   await coreClient.function('based-db-set', {
  //     type: 'thing',
  //     name: 'YES' + i,
  //   })
  // }

  const makeButton = (label: string, fn: () => void) => {
    const button = document.createElement('button')
    button.innerHTML = label
    button.style.margin = '40px'
    button.onclick = fn
    document.body.appendChild(button)
  }

  makeButton('set thing', () => {
    coreClient.function('based-db-set', {
      type: 'thing',
      name: 'BLAAAA',
    })
  })

  makeButton('hello', async () => {
    console.info('hello:', await coreClient.function('hello'))
  })

  makeButton('add many things', () => {
    for (let i = 0; i < 1000; i++) {
      coreClient.function('based-db-set', {
        type: 'thing',
        name: 'YES' + i,
      })
    }
  })

  makeButton('crasher', () => {
    coreClient.function('crasher').catch((err) => {
      console.error(err)
    })
  })

  makeButton('init obs crash', () => {
    coreClient.observe(
      'obsInitCrash',
      (d) => {
        console.info(d)
      },
      (err) => {
        console.error(err)
      }
    )
  })

  makeButton('init obs crash GET', () => {
    coreClient.get('obsInitCrash').catch((err) => {
      console.error(err)
    })
  })

  makeButton('rando obs crash', () => {
    coreClient.observe(
      'obsRandomUpdateCrash',
      (d) => {
        console.info('rando', d)
      },
      (err) => {
        console.error(err)
      }
    )
  })

  makeButton('obsObserverCrash', () => {
    coreClient.observe(
      'obsObserverCrash',
      (d) => {
        console.info('obsObserverCrash -> ', d)
      },
      (err) => {
        console.error(err)
      }
    )
  })

  // const x = await coreClient.get('counter')

  // console.info('FUN', x)

  // coreClient.observe('counter', (d) => {
  //   console.info('--->', d)
  // })

  // const close = coreClient.observe('chill', (d) => {
  //   console.info('chill', d)
  // })

  // setTimeout(() => {
  //   close()
  // }, 1e3)

  // const iqTest = await coreClient.function('iqTest')
  // const small = await coreClient.function('small')

  // console.info(iqTest)
  // console.info(small)

  // let str = ''
  // for (let i = 0; i < 20000; i++) {
  //   str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
  // }

  // let i = 100e3
  // while (--i) {
  //   try {
  //     const flap = await coreClient.function('hello', str)
  //     console.info('GOT FLAP', flap)
  //   } catch (err) {
  //     console.error(err)
  //   }
  // }
  // const close = await coreClient.observe('counter', (data) => {
  //   console.log('incoming', data)
  // })

  // await new Promise((resolve, reject) => setTimeout(resolve, 2500))

  // close()
}

init()

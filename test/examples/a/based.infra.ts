export default {
  env: {
    machine: 't3.small',
    max: 1,
    min: 1,
    services: {
      '@based/env-config-db': {
        distChecksum: '28328093bbebaad142cb9116c01780b189619946-e-b-m0658dca83cf9d40262a7a160f71d5569e0cea4ca',
        instances: {
          '0': {
            port: 4001
          }
        }
      },
      '@based/env-db': {
        distChecksum: 'e2c1631ea15911b50f3d3554f7bf60ad0c9de9ca-e-b-m0658dca83cf9d40262a7a160f71d5569e0cea4ca',
        instances: {
          '0': {
            port: 4002
          }
        }
      },
      '@based/env-db-registry': {
        distChecksum: 'a88cf4be0eff77f00eed271f2c47855e2de94ad8-e-b-m0658dca83cf9d40262a7a160f71d5569e0cea4ca',
        instances: {
          '0': {
            port: 4003
          }
        }
      },
      '@based/env-db-sub-manager': {
        distChecksum: 'b6598eab360ffa690e755695cb51e5ff43b0061e-e-b-m0658dca83cf9d40262a7a160f71d5569e0cea4ca',
        instances: {
          '0': {
            port: 4004
          }
        }
      },
      '@based/env-events-hub': {
        distChecksum: 'c5e7c6de6b6cf2a475305ee58499dc4f45952233-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b',
        instances: {
          '0': {
            port: 4005
          }
        }
      },
      '@based/env-hub-discovery': {
        distChecksum: '00d6c5dc314a1f8a0badeba394caa096e6102f49-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b',
        instances: {
          '0': {
            port: 80
          }
        }
      },
      '@based/env-jobs': {
        distChecksum: '7bb03038ad23fa6176130b178f4f93b6043b964e-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b',
        instances: {
          '0': {
            port: 4006
          }
        }
      },
      '@based/env-metrics-db': {
        distChecksum: '2e2a280924b1fb77c1b3e5c8c9d50d82bfe906b1-e-b-m0658dca83cf9d40262a7a160f71d5569e0cea4ca',
        instances: {
          '0': {
            port: 4007
          }
        }
      },
      '@based/env-registry': {
        distChecksum: '1a1c6173d030590ff4f782ecabeacbf932de0fa4-e-d-mc51c251ee6c9f919d210490ff8ae8482246b227c-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b',
        instances: {
          '0': {
            port: 4000
          }
        }
      }
    }
  },
  envHub: {
    machine: 't3.micro',
    max: 1,
    min: 1,
    services: {
      '@based/env-hub': {
        distChecksum: 'b167a8959af53af3ceefade3ac6bea0b55d84d37-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b-e-a-m1294494b1fea4c19a3125f23b7efff8643de712b',
        instances: {
          '0': {
            port: 80
          }
        }
      }
    }
  }
};

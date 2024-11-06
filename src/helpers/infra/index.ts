export const exportInfraTemplate = ({
  name,
  description,
  domains,
  machine,
  min,
  max,
}: Based.Infra.TemplateInfo): Based.Infra.Template => ({
  env: {
    configName: name.trim(),
    description: description.trim(),
    domains,
    machine,
    min,
    max,
    services: {
      '@based/env-hub-discovery': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 80,
          },
        },
      },
      '@based/env-registry': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 4000,
          },
        },
      },
      '@based/env-config-db': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 4001,
          },
        },
      },
      '@based/env-db': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 4002,
          },
        },
      },
      '@based/env-db-registry': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 4003,
          },
        },
      },
      '@based/env-db-sub-manager': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 4004,
          },
        },
      },
      '@based/env-events-hub': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 4005,
          },
        },
      },
      '@based/env-jobs': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 4006,
          },
        },
      },
      '@based/env-metrics-db': {
        distChecksum: 'latest',
        instances: {
          '0': {
            port: 4007,
          },
        },
      },
    },
  },
})

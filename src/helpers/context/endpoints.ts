// TODO
// We could have an cloud function to retrieve all the available endpoints, this also could be integrated with feature flags
export const endpoints = {
  CONNECTIONS: {
    client: 'project',
    endpoint: 'based:connections',
    type: 'query',
  },
  DB_LIST: {
    client: 'project',
    endpoint: 'based:db-list',
    type: 'call',
  },
  DB_FLUSH: {
    client: 'project',
    endpoint: 'based:db-flush',
    type: 'call',
  },
  BACKUPS_DOWNLOAD: {
    client: 'project',
    endpoint: 'based:backups-download',
    type: 'call',
  },
  BACKUPS_LIST: {
    client: 'env',
    endpoint: 'based:backups-list',
    type: 'call',
  },
  BACKUPS_ENV: {
    client: 'cluster',
    endpoint: 'backup-env',
    type: 'call',
  },
  BACKUPS_SELECT: {
    client: 'project',
    endpoint: 'based:backups-select',
    type: 'call',
  },
  BACKUPS_UPLOAD: {
    client: 'project',
    endpoint: 'based:backups-upload',
    type: 'stream',
  },
  ENV_INFO: {
    client: 'project',
    endpoint: 'based:env-info',
    type: 'call',
  },
  DEPLOY_SET_SCHEMA: {
    client: 'project',
    endpoint: 'db:set-schema',
    type: 'call',
  },
  DEPLOY_FILE_UPLOAD: {
    client: 'project',
    endpoint: 'db:file-upload',
    type: 'stream',
  },
  DEPLOY_SET_FUNCTION: {
    client: 'project',
    endpoint: 'based:set-function',
    type: 'stream',
  },
  DEPLOY_SET_SOURCEMAP: {
    client: 'project',
    endpoint: 'based:set-sourcemap',
    type: 'stream',
  },
  LOGS_DELETE: {
    client: 'project',
    endpoint: 'based:logs-delete',
    type: 'call',
  },
  LOGS_FILTER: {
    client: 'project',
    endpoint: 'db',
    type: 'query',
  },
  LOGS_CLUSTER: {
    client: 'cluster',
    endpoint: 'logs',
    type: 'query',
  },
  LOGS_ENV: {
    client: 'env',
    endpoint: 'based:logs',
    type: 'query',
  },
} as const satisfies Based.API.Gateway.Endpoints<
  Record<string, Based.API.Gateway.Endpoint>
>

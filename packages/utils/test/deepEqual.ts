import test from 'ava'
import { deepEqual } from '../src/index.js'

test('deepEqual ', async (t) => {
  const bla = { x: true, y: true, z: [1, 2, 3, 4, { x: true }] }
  const blarf = { x: true, y: true, z: [1, 2, 3, 4, { x: true }] }

  t.true(deepEqual(bla, blarf))

  const a = { x: 'x', y: undefined }
  const b = { x: 'x', y: undefined }

  t.true(deepEqual(a, b))
})

test('deepEqual 2', async (t) => {
  const bla = {
    id: 213891765,
    privateIp: '10.114.0.21',
    publicIp: '159.89.17.141',
    name: 'my-special-app-for-testing-super-secret-0-fra1',
    tags: {
      app: 'my_special_app_for_testing_super_secret',
      env: 'production',
      net: 'private',
      project: 'supersecretspecialtestproject',
      org: 'saulx',
    },
    specs: {
      memory: '1gb',
      cpus: 1,
      image: 'ubuntu-nodejs',
      region: 'fra1',
      cloudProvider: 'do',
      sizeName: 's-1vcpu-1gb',
    },
    price: 5,
  }
  const blarf = {
    id: 213891765,
    privateIp: '10.114.0.21',
    publicIp: '159.89.17.141',
    name: 'my-special-app-for-testing-super-secret-0-fra1',
    tags: {
      app: 'my_special_app_for_testing_super_secret',
      env: 'production',
      net: 'private',
      project: 'supersecretspecialtestproject',
      org: 'saulx',
    },
    specs: {
      memory: '1gb',
      cpus: 1,
      image: 'ubuntu-nodejs',
      region: 'fra1',
      cloudProvider: 'do',
      sizeName: 's-1vcpu-1gb',
    },
    price: 5,
  }

  t.true(deepEqual(bla, blarf))
})

test('deepEqual 3', async (t) => {
  const bla = {
    id: 213906207,
    privateIp: '10.114.0.20',
    publicIp: '167.99.139.137',
    name: 'fra1-my-special-app-for-testing-super-secret-5c44610-0',
    tags: {
      app: 'my_special_app_for_testing_super_secret',
      env: 'production',
      net: 'private',
      project: 'supersecretspecialtestproject',
      org: 'saulx',
    },
    specs: {
      memory: '1gb',
      image: 'ubuntu-nodejs',
      region: 'fra1',
      cpus: 4,
      cloudProvider: 'do',
      sizeName: 's-4vcpu-8gb',
    },
    price: 5,
  }
  const blarf = {
    id: 213906207,
    privateIp: '10.114.0.20',
    publicIp: '167.99.139.137',
    name: 'fra1-my-special-app-for-testing-super-secret-5c44610-0',
    tags: {
      app: 'my_special_app_for_testing_super_secret',
      env: 'production',
      net: 'private',
      project: 'supersecretspecialtestproject',
      org: 'saulx',
    },
    specs: {
      memory: '8gb',
      cpus: 4,
      image: 'ubuntu-nodejs',
      region: 'fra1',
      cloudProvider: 'do',
      sizeName: 's-4vcpu-8gb',
    },
    price: 40,
  }

  t.false(deepEqual(bla, blarf))
})

test('deepEqual 4', async (t) => {
  const bla = {
    id: 213913182,
    privateIp: '10.110.0.2',
    publicIp: '128.199.41.139',
    name: 'ams3-my-special-app-for-testing-super-secret-persist-33057c3-0',
    tags: {
      app: 'my_special_app_for_testing_super_secret_persist',
      env: 'production',
      net: 'private',
      project: 'supersecretspecialtestproject',
      org: 'saulx',
    },
    specs: {
      memory: '1gb',
      cpus: 1,
      image: 'ubuntu-nodejs',
      region: 'ams3',
      cloudProvider: 'do',
      sizeName: 's-1vcpu-1gb',
    },
    price: 5,
    domain: 'my-special-app-for-testing-super-secret-persist.based.io',
  }
  const blarf = {
    id: 213913182,
    privateIp: '10.110.0.2',
    publicIp: '128.199.41.139',
    name: 'ams3-my-special-app-for-testing-super-secret-persist-33057c3-0',
    tags: {
      app: 'my_special_app_for_testing_super_secret_persist',
      env: 'production',
      net: 'private',
      project: 'supersecretspecialtestproject',
      org: 'saulx',
    },
    specs: {
      memory: '1gb',
      cpus: 1,
      image: 'ubuntu-nodejs',
      region: 'ams3',
      cloudProvider: 'do',
      sizeName: 's-1vcpu-1gb',
    },
    price: 5,
  }
  t.false(deepEqual(bla, blarf))
})

test('deepEqual _keys', async (t) => {
  const bla = {
    hello: 'super cool',
    what: {
      nested: 'yes',
      _yeah: true,
    },
    _niceKey: 1,
  }
  const blarf = {
    hello: 'super cool',
    what: {
      nested: 'yes',
      _yeah: true,
    },
    _niceKey: 1,
  }
  t.true(deepEqual(bla, blarf), 'same object with _key')
  blarf._niceKey = 2
  t.false(deepEqual(bla, blarf), 'change _key value')
})

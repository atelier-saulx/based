import {
    compile,
    createRecord,
    readValue,
    writeValue,
    readString,
} from '../src/index.js';

const recordDefEx = [
    { name: 'a', type: 'uint32_le' },
    { name: 'b', type: 'int32_le' },
    { name: 'c', type: 'int_le', size: 3 },
    { name: 'd', type: 'int_le', size: 5 },
    { name: 'nested', type: 'record', def: [
        { name: 'a', type: 'uint32_le' },
        { name: 'b', type: 'uint32_le' }
    ]},
    { name: 'x', type: 'record', def: [
        { name: 'a', type: 'uint32_le' },
        { name: 'y', type: 'record', def: [
            { name: 'a', type: 'uint32_le' },
        ]}
    ]},
    { name: 'firstName', type: 'string', size: 15 },
];

const obj = {
    a: 4,
    b: -128,
    c: 10,
    d: 5,
    nested: {
        a: 5,
        b: 5,
    },
    x: {
        a: 5,
        y: {
            a: 5
        }
    },
    firstName: 'Olli',
};

console.log('obj', obj);

const compiled = compile(recordDefEx);
console.log('compiledDef', compiled);

const buf = createRecord(compiled, obj);
console.log('buf', buf);

writeValue(compiled, buf, '.x.y.a', 1337);
console.log('read .x.y.a', readValue(compiled, buf, '.x.y.a'));

console.log(`read firstName: ${readString(compiled, buf, '.firstName', 'utf8')}`);

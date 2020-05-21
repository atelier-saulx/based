import v8 from 'v8';
import {
  performance,
  PerformanceObserver
} from 'perf_hooks';
import {
    compile,
    createRecord,
    readValue,
    writeValue,
    createReader,
    createWriter,
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
    }
};

const compiled = compile(recordDefEx);
const buf = createRecord(compiled, obj);
const writer = createWriter(buf, compiled, '.x.y.a');
const reader = createReader(buf, compiled, '.x.y.a');

const COUNT = 99999;

function nativeObjectTest() {
    let x = 0;
	for (let i = 0; i < COUNT; i++) {
        x = obj.x.y.a;
        obj.x.y.a = i;
	}
}

function nativeV8SerializerTest() {
    let ser = v8.serialize(obj);
    let x = 0;
	for (let i = 0; i < COUNT; i++) {
        const o = v8.deserialize(ser);
        x = o.x.y.a;
        o.x.y.a = i;
        ser = v8.serialize(o);
	}
}

function jsonTest() {
    let str = JSON.stringify(obj);
    let x = 0;
    for (let i = 0; i < COUNT; i++) {
        const o = JSON.parse(str);
        x = o.x.y.a;
        o.x.y.a = i;
        str = JSON.stringify(o);
    }
}

function dataRecordTestSlow() {
    let x = 0;
	for (let i = 0; i < COUNT; i++) {
        x = readValue(buf, compiled, '.x.y.a');
        writeValue(buf, compiled, '.x.y.a', i);
	}
}

function dataRecordTestFast() {
    let x = 0;
	for (let i = 0; i < COUNT; i++) {
        x = reader();
        writer(i);
	}
}

const wrapped = [
    nativeObjectTest,
    nativeV8SerializerTest,
    jsonTest,
    dataRecordTestSlow,
    dataRecordTestFast,
].map(performance.timerify);

const obs = new PerformanceObserver((list) => {
  const entry = list.getEntries()[0];
  console.log(`${entry.name}: ${entry.duration} ms`);
  //obs.disconnect();
});
obs.observe({ entryTypes: ['function'] });

for (const test of wrapped) {
    test();
}

const objSerialized = v8.serialize(obj);
console.log(`buf.length = ${buf.length}, objSerialized.length = ${objSerialized.length}`);

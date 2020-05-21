import v8 from 'v8';
import {
  performance,
  PerformanceObserver
} from 'perf_hooks';
import {
    compile,
    createRecord,
    getValue,
    setValue,
    createReader,
    createWriter,
} from '../src/index.js';

const recordDefEx = [
    { name: 'a', type: 'uint32_t' },
    { name: 'b', type: 'int32_t' },
    { name: 'nested', type: 'record', def: [
        { name: 'a', type: 'uint32_t' },
        { name: 'b', type: 'uint32_t' }
    ]},
    { name: 'x', type: 'record', def: [
        { name: 'a', type: 'uint32_t' },
        { name: 'y', type: 'record', def: [
            { name: 'a', type: 'uint32_t' },
        ]}
    ]},
];

const obj = {
    a: 4,
    b: -128,
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

console.log('obj', obj);

const compiled = compile(recordDefEx);
console.log('compiledDef', compiled);

const buf = createRecord(compiled, obj);
console.log('buf', buf);

setValue(buf, compiled, '.x.y.a', 1337);
console.log('read', getValue(buf, compiled, '.x.y.a'));

const COUNT = 99999;

const writer = createWriter(buf, compiled, '.x.y.a');
const reader = createReader(buf, compiled, '.x.y.a');

function dataRecordTest() {
    let x = 0;
	for (let i = 0; i < COUNT; i++) {
        x = reader();
        writer(i);
	}
}

function nativeObjectTest() {
    let x = 0;
	for (let i = 0; i < COUNT; i++) {
        x = obj.x.y.a;
        obj.x.y.a = i;
	}
}

function nativeObjectSerTest() {
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

const wrapped = [
    nativeObjectTest,
    nativeObjectSerTest,
    jsonTest,
    dataRecordTest
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

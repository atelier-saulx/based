import v8 from 'v8';
import { performance, PerformanceObserver } from 'perf_hooks';
import util from 'util';
import fs from 'fs';
import { join as pathJoin } from 'path';
import gc from './util/gc';
import sleep from './util/sleep';
import { compile, allocRecord, serialize, deserialize, writeValue, generateRecordDef } from '../src/index';

const COUNT = 99999;
const obj = JSON.parse(fs.readFileSync(pathJoin(__dirname, './data/data.json')).toString());
const recordDef = generateRecordDef(obj);
console.log(util.inspect(recordDef, false, null, true));

function nativeV8SerializerTest() {
	const o = JSON.parse(JSON.stringify(obj));

	for (let i = 0; i < COUNT; i++) {
		//o.x.y.a = i;
		v8.deserialize(v8.serialize(o));
	}
}

function jsonTest() {
	let o = JSON.parse(JSON.stringify(obj));

	for (let i = 0; i < COUNT; i++) {
		//o.x.y.a = i;
		JSON.parse(JSON.stringify(o));
	}
}

function dataRecordSerializeTest() {
	const compiled = compile(recordDef);
	let o = JSON.parse(JSON.stringify(obj));

	for (let i = 0; i < COUNT; i++) {
		const buf = allocRecord(compiled);

		//o.x.y.a = i;
		deserialize(compiled, serialize(compiled, buf, o));
	}
}

// @ts-ignore
function dataRecordWriteTest() {
	const compiled = compile(recordDef);
	let o = JSON.parse(JSON.stringify(obj));

	for (let i = 0; i < COUNT; i++) {
		const buf = allocRecord(compiled);

		o.x.y.a = i;
		writeValue(compiled, buf, '.a', o.a);
		writeValue(compiled, buf, '.b', o.b);
		writeValue(compiled, buf, '.c', o.c);
		writeValue(compiled, buf, '.d', o.d);
		writeValue(compiled, buf, '.nested.a', o.nested.a);
		writeValue(compiled, buf, '.nested.b', o.nested.b);
		writeValue(compiled, buf, '.x.a', o.x.a);
		writeValue(compiled, buf, '.x.y.a', o.x.y.a);
	}
}

const wrapped = [
	nativeV8SerializerTest,
	jsonTest,
	dataRecordSerializeTest,
	//dataRecordWriteTest,
].map(performance.timerify);

test('Test deserialization performance', () => {
	const logs: string[] = [];
	const obs = new PerformanceObserver((list) => {
		const entry = list.getEntries()[0];
		logs.push(`${entry.name}: ${entry.duration} ms`);
	});
	obs.observe({ entryTypes: ['function'] });

	for (const test of wrapped) {
		gc();
		test();
	}

	sleep(1000);
	console.log(`Perf test: serialization\n${logs.join('\n')}`);
});

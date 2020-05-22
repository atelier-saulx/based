import v8 from 'v8';
import { performance } from 'perf_hooks';
import util from 'util';
import fs from 'fs';
import { join as pathJoin } from 'path';
import gc from './util/gc';
import { compile, allocRecord, serialize, deserialize, writeValue, generateRecordDef } from '../src/index';

const COUNT = 99999;

export default function serialization() {
	const obj = JSON.parse(fs.readFileSync(pathJoin(__dirname, './data/data.json')).toString());
	const recordDef = generateRecordDef(obj);
	//console.log(util.inspect(recordDef, false, null, true));

	function nativeV8SerializerTest() {
		const o = JSON.parse(JSON.stringify(obj));

		for (let i = 0; i < COUNT; i++) {
			v8.deserialize(v8.serialize(o));
		}
	}

	function jsonTest() {
		let o = JSON.parse(JSON.stringify(obj));

		for (let i = 0; i < COUNT; i++) {
			JSON.parse(JSON.stringify(o));
		}
	}

	function dataRecordSerializeTest() {
		const compiled = compile(recordDef);
		let o = JSON.parse(JSON.stringify(obj));

		for (let i = 0; i < COUNT; i++) {
			const buf = allocRecord(compiled);

			//deserialize(compiled, serialize(compiled, buf, o));
			serialize(compiled, buf, o);
		}
	}

	const wrapped = [
		nativeV8SerializerTest,
		jsonTest,
		dataRecordSerializeTest,
	].map(performance.timerify);


	for (const test of wrapped) {
		gc();
		test();
	}
}

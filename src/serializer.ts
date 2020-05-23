import { CompiledRecordDef } from './compiler';
import { getReadFunc, getWriteFunc } from './accessors';

export function serialize(compiledDef: CompiledRecordDef, buf: Buffer, obj: any) {
	const ops = getWriteFunc(buf);
	const fl = compiledDef.fieldList;
	const n = compiledDef.fieldList.length;

	for (let i = 0; i < n; i++) {
		const z = fl[i];
		const path = z[3];
		const v = path.reduce((o, j) => o[j], obj);

		try {
			// z[0] = offset
			// z[1] = size
			// z[2] = type
			// @ts-ignore
			ops[z[2]](v, z[0], z[1]);
		} catch (err) {
			err.name = path;
			throw err;
		}
	}

	return buf;
}

export function deserialize(compiledDef: CompiledRecordDef, buf: Buffer): any {
	const ops = getReadFunc(buf);
	const obj: { [index: string]: any } = {};

	for (const [offset, size, type, names] of compiledDef.fieldList) {
		let cur = obj;
		let prev = cur;
		let name: string;
		for (name of names) {
			prev = cur;
			if (!cur[name]) {
				cur[name] = {};
			}
			cur = cur[name];
		}

		// cstring
		if (type === 'w') {
			// @ts-ignore
			prev[name] = ops[type](offset, size, 'utf8');
		} else {
			// @ts-ignore
			prev[name] = ops[type](offset, size);
		}
	}

	return obj;
}

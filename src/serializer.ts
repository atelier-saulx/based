import { CompiledRecordDef } from './compiler';
import { getReadFuncs, getWriteFuncs } from './accessors';

export function serialize(compiledDef: CompiledRecordDef, buf: Buffer, obj: any) {
	const ops = getWriteFuncs(buf);
	const fl = compiledDef.fieldList;
	const n = compiledDef.fieldList.length;

	for (let i = 0; i < n; i++) {
		const z = fl[i];
		const path = z[4];
		const v = path.reduce((o, j) => o[j], obj);

		try {
			// z[0] = offset
			// z[1] = size
			// z[2] = arrSize
			// z[3] = type
			if (z[2] > 0) {
				let j = 0;
				for (let i = 0; i < z[2]; i++) {
					// @ts-ignore
					ops[z[3]](v[j++], z[0] + i * z[1], z[1]);
				}
			} else {
				ops[z[3]](v, z[0], z[1]);
			}
		} catch (err) {
			err.name = path;
			throw err;
		}
	}

	return buf;
}

export function deserialize(compiledDef: CompiledRecordDef, buf: Buffer): any {
	const ops = getReadFuncs(buf);
	const obj: { [index: string]: any } = {};

	for (const [offset, size, arrSize, type, names] of compiledDef.fieldList) {
		let cur = obj;
		let prev = cur;
		let name: string = '';
		for (name of names) {
			prev = cur;
			if (!cur[name]) {
				cur[name] = {};
			}
			cur = cur[name];
		}

		const op = ops[type];

		if (arrSize > 0) {
			prev[name] = [];
			const arr = prev[name];

			for (let i = 0; i < arrSize; i++) {
				arr[i] = op(offset + i * size, size, 'utf8');
			}
		} else {
			prev[name] = op(offset, size, 'utf8');
		}
	}

	return obj;
}

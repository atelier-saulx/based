import { CompiledRecordDef } from './compiler';
import { getReadFuncs, getWriteFuncs } from './accessors';

function getV(obj: any, path: string[], fullName: string) {
	// If it's a record array then there is a special naming convention
	// record.name.here[index] and we'll need to parse those [] parts.
	if (!fullName.includes('[')) {
		return path.reduce((o, j) => o[j], obj);
	} else {
		return path.reduce((o, j) => {
			const [realPath, rest] = j.split('[');

			if (rest) {
				const i = Number(rest.substring(0, rest.length - 1));

				return o[realPath][i];
			}
			return o[realPath];
		}, obj);
	}
}

export function serialize(compiledDef: CompiledRecordDef, buf: Buffer, obj: any) {
	const ops = getWriteFuncs(buf);
	const fl = compiledDef.fieldList;
	const n = compiledDef.fieldList.length;

	for (let i = 0; i < n; i++) {
		// z[0] = offset
		// z[1] = size
		// z[2] = arrSize
		// z[3] = type
		// z[4] = path
		// z[5] = fullNam
		const z = fl[i];
		const type = z[3];
		const path = z[4];
		const v = getV(obj, path, z[5]);

		try {
			if (z[2] > 0) {
				let j = 0;
				for (let i = 0; i < z[2]; i++) {
					// @ts-ignore
					ops[type](v[j++], z[0] + i * z[1], z[1]);
				}
			} else {
				ops[type](v, z[0], z[1]);
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

import { CompiledRecordDef } from './compiler';
import { getReadFuncs, getWriteFuncs } from './accessors';
import { memalign_word } from './mach';
import { isPointerType } from './types';

/**
 * Get the node.
 */
export function getNode(obj: any, path: string[], fullName: string) {
	// If it's a record array then there is a special naming convention
	// record.name.here[index] and we'll need to parse those [] parts.
	if (!fullName.includes('[')) {
		// not a record array
		return path.reduce((o, j) => o[j], obj);
	} else {
		// the path contains one or more record arrays (array of objects)
		return path.reduce((o, j) => {
			const [realName, rest] = j.split('[');

			if (rest) {
				// found an array of records
				const i = Number(rest.substring(0, rest.length - 1));

				return o[realName][i];
			}
			return o[realName];
		}, obj);
	}
}

export function serialize(compiledDef: CompiledRecordDef, buf: Buffer, obj: any) {
	let heapOffset = compiledDef.size;
	const ops = getWriteFuncs(buf);
	const fl = compiledDef.fieldList;
	const n = compiledDef.fieldList.length;

	for (let i = 0; i < n; i++) {
		// z[0] = offset
		// z[1] = size
		// z[2] = arrSize
		// z[3] = type
		// z[4] = path
		// z[5] = fullName
		const z = fl[i];
		const typeSize = z[1];
		const type = z[3];
		const incrHeap = isPointerType(type)
			?
					(d: string) => {
						if (d) {
							heapOffset += compiledDef.align(d.length);
						}
					}
			: () => {};
		const path = z[4];
		const v = getNode(obj, path, z[5]);

		try {
			if (z[2] > 0) {
				// it's an array
				let j = 0;
				for (let i = 0; i < z[2]; i++) {
					// for each value
					const d = v[j];
					ops[type](d, z[0] + i * typeSize, typeSize, heapOffset);
					incrHeap(d);
					j++;
				}
			} else {
				// just a value
				ops[type](v, z[0], typeSize, heapOffset);
				incrHeap(v);
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
		let name: string | number = '';

		for (name of names) {
			prev = cur;
			if (!name.includes('[')) {
				// Not a record array
				if (!cur[name]) {
					cur[name] = {};
				}

				cur = cur[name];
			} else {
				// a record array
				const [realName, rest] = name.split('[');

				const i = Number(rest.substring(0, rest.length - 1));
				if (!cur[realName]) {
					cur[realName] = [];
				}
				if (!cur[realName][i]) {
					cur[realName][i] = {};
				}

				cur = cur[realName][i];
				name = i;
			}
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

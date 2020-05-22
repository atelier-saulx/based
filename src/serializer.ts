import { CompiledRecordDef } from './compiler';
import { getReadFunc, getWriteFunc } from './accessors';

export function serialize(compiledDef: CompiledRecordDef, buf: Buffer, obj: any) {
	const ops = getWriteFunc(buf);

	for (const [offset, size, type, path] of compiledDef.fieldList) {
		const names = path.substring(1).split('.');

		let cur = obj;
		for (const name of names) {
			cur = cur[name];
		}

		try {
			// @ts-ignore
			ops[type](cur, offset, size);
		} catch (err) {
			err.name = path;
			throw err;
		}
	}

	return buf;
}

export function deserialize(compiledDef: CompiledRecordDef, buf: Buffer) {
	const ops = getReadFunc(buf);
	const obj: { [index: string]: any } = {};

	for (const [offset, size, type, path] of compiledDef.fieldList) {
		const names = path.substring(1).split('.');

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

		// string
		if (type === 'w') {
			// @ts-ignore
			prev[name] = Buffer.from(buf.subarray(offset, offset + size));
		} else {
			// @ts-ignore
			prev[name] = ops[type](offset, size);
		}
	}

	return obj;
}

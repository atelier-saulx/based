import { Encoding, TYPES, isPointerType } from './types';
import { CompiledRecordDef } from './compiler';
import { WORD_SIZE, MACH_TYPE } from './mach';

function readWord(buf: Buffer, offset: number): number | bigint {
	switch (MACH_TYPE) {
		case 'BE4':
			return buf.readUInt32BE(offset);
		case 'BE8':
			return buf.readBigUInt64BE(offset);
		case 'LE4':
			return buf.readUInt32LE(offset);
		case 'LE8':
			return buf.readBigUInt64LE(offset);
		default:
			throw new Error('Arch not supported');
	}
}

function bufferReadCstring(buf: Buffer, offset: number, len: number, encoding?: Encoding): Buffer | string {
	if (encoding && ['utf8', 'utf16le', 'latin1', 'ascii'].includes(encoding)) {
		const sub = buf.subarray(offset, offset + len);
		const ind = sub.indexOf(0);
		const str = ind > 0 ? sub.subarray(0, ind) : sub;

		return Buffer.from(str).toString(encoding);
	} else if (encoding) {
		return buf.toString(encoding, offset, offset + len);
	}

	return Buffer.from(buf.subarray(offset, offset + len));
}

function bufferReadCstringP(buf: Buffer, offset: number, _len: number, encoding: Encoding): Buffer | string | null {
	const str_p = Number(readWord(buf, offset));
	const str_len = Number(readWord(buf, offset + WORD_SIZE));

	if (Number(str_p) === 0) {
		return null;
	}

	return bufferReadCstring(buf, str_p, str_len, encoding);
}

function derefPointer(buf: Buffer, offset: number): [number, number] {
	const dest = Number(readWord(buf, offset));
	const size = Number(readWord(buf, offset + WORD_SIZE));

	return [dest, size];
}

function setPointer(buf: Buffer, offset: number, destOffset: number, size: number) {
	writeWord(buf, offset, destOffset);
	writeWord(buf, offset + WORD_SIZE, size);
}

function writeWord(buf: Buffer, offset: number, value: number | bigint) {
	switch (MACH_TYPE) {
		case 'BE4':
			buf.writeUInt32BE(Number(value), offset);
			break;
		case 'BE8':
			buf.writeBigUInt64BE(BigInt(value), offset);
			break;
		case 'LE4':
			buf.writeUInt32LE(Number(value), offset);
			break;
		case 'LE8':
			buf.writeBigUInt64LE(BigInt(value), offset);
			break;
		default:
			throw new Error('Arch not supported');
	}
}

function bufferWriteCstringP(
	buf: Buffer,
	offset: number,
	destOffset: number,
	value: string,
	_len: number,
	encoding: Encoding
) {
	if (!value) {
		setPointer(buf, offset, 0, 0);
		return 0;
	}

	setPointer(buf, offset, destOffset, value.length);
	return buf.write(value, destOffset, value.length, encoding);
}

type BufferReadFunction = (offset: number, len: number, encoding?: Encoding) => any;

/**
 * Get read functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
export function getReadFuncs(buf: Buffer): { [index: string]: BufferReadFunction } {
	return {
		a: (offset: number): number => buf.readInt8(offset),
		pa: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size)).map((_, i) => buf.readInt8(p + i));
		},
		b: (offset: number): number => buf.readInt16BE(offset),
		pb: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 2)).map((_, i) => buf.readInt16BE(p + 2 * i));
		},
		c: (offset: number): number => buf.readInt16LE(offset),
		pc: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 2)).map((_, i) => buf.readInt16LE(p + 2 * i));
		},
		d: (offset: number): number => buf.readInt32BE(offset),
		pd: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 4)).map((_, i) => buf.readInt32BE(p + 4 * i));
		},
		e: (offset: number): number => buf.readInt32LE(offset),
		pe: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 4)).map((_, i) => buf.readInt32LE(p + 4 * i));
		},
		f: (offset: number): bigint => buf.readBigInt64BE(offset),
		pf: (offset: number): bigint[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 8)).map((_, i) => buf.readBigInt64BE(p + 8 * i));
		},
		g: (offset: number): bigint => buf.readBigInt64LE(offset),
		pg: (offset: number): bigint[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 8)).map((_, i) => buf.readBigInt64LE(p + 8 * i));
		},
		h: (offset: number): number => buf.readUInt8(offset),
		ph: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			console.log('size', size, p);
			return Array.from(Array(size)).map((_, i) => buf.readUInt8(p + i));
		},
		i: (offset: number): number => buf.readUInt16BE(offset),
		pi: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 2)).map((_, i) => buf.readUInt16BE(p + 2 * i));
		},
		j: (offset: number): number => buf.readUInt16LE(offset),
		pj: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 2)).map((_, i) => buf.readUInt16LE(p + 2 * i));
		},
		k: (offset: number): number => buf.readUInt32BE(offset),
		pk: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 4)).map((_, i) => buf.readUInt32BE(p + 4 * i));
		},
		l: (offset: number): number => buf.readUInt32LE(offset),
		pl: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 4)).map((_, i) => buf.readUInt32LE(p + 4 * i));
		},
		m: (offset: number): bigint => buf.readBigUInt64BE(offset),
		pm: (offset: number): bigint[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 8)).map((_, i) => buf.readBigUInt64BE(p + 8 * i));
		},
		n: (offset: number): bigint => buf.readBigUInt64LE(offset),
		pn: (offset: number): bigint[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 8)).map((_, i) => buf.readBigUInt64LE(p + 8 * i));
		},
		o: (offset: number): number => buf.readFloatBE(offset),
		po: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 4)).map((_, i) => buf.readFloatBE(p + 4 * i));
		},
		p: (offset: number): number => buf.readFloatLE(offset),
		pp: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 4)).map((_, i) => buf.readFloatLE(p + 4 * i));
		},
		q: (offset: number): number => buf.readDoubleBE(offset),
		pq: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 8)).map((_, i) => buf.readDoubleBE(p + 8 * i));
		},
		r: (offset: number): number => buf.readDoubleLE(offset),
		pr: (offset: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / 8)).map((_, i) => buf.readDoubleLE(p + 8 * i));
		},
		s: (offset: number, len: number): number => buf.readIntBE(offset, len),
		ps: (offset: number, len: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / len)).map((_, i) => buf.readIntBE(p + len * i, len));
		},
		t: (offset: number, len: number): number => buf.readIntLE(offset, len),
		pt: (offset: number, len: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / len)).map((_, i) => buf.readIntLE(p + len * i, len));
		},
		u: (offset: number, len: number): number => buf.readUIntBE(offset, len),
		pu: (offset: number, len: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / len)).map((_, i) => buf.readUIntBE(p + len * i, len));
		},
		v: (offset: number, len: number): number => buf.readUIntLE(offset, len),
		pv: (offset: number, len: number): number[] | null => {
			const [p, size] = derefPointer(buf, offset);
			if (p === 0) {
				return null;
			}

			return Array.from(Array(size / len)).map((_, i) => buf.readUIntLE(p + len * i, len));
		},
		w: (offset: number, len: number, encoding: Encoding): Buffer | string =>
			bufferReadCstring(buf, offset, len, encoding),
		pw: (offset: number, len: number, encoding: Encoding): Buffer | string | null =>
			bufferReadCstringP(buf, offset, len, encoding),
	};
}

type BufferWriteFunction = (v: any, offset: number, len: number, destOffset: number, encoding?: Encoding) => void;

/**
 * Get write functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
export function getWriteFuncs(buf: Buffer): { [index: string]: BufferWriteFunction } {
	return {
		a: (v: number, offset: number): number => buf.writeInt8(v, offset),
		pa: (v: number[], offset: number, destOffset: number): number => {
			const size = v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeInt8(v[i], destOffset + i);
			});

			return size;
		},
		b: (v: number, offset: number): number => buf.writeInt16BE(v, offset),
		pb: (v: number[], offset: number, destOffset: number): number => {
			const size = 2 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeInt16BE(v[i], destOffset + 2 * i);
			});

			return size;
		},
		c: (v: number, offset: number): number => buf.writeInt16LE(v, offset),
		pc: (v: number[], offset: number, destOffset: number): number => {
			const size = 2 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeInt16LE(v[i], destOffset + 2 * i);
			});

			return size;
		},
		d: (v: number, offset: number): number => buf.writeInt32BE(v, offset),
		pd: (v: number[], offset: number, destOffset: number): number => {
			const size = 4 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeInt32BE(v[i], destOffset + 4 * i);
			});

			return size;
		},
		e: (v: number, offset: number): number => buf.writeInt32LE(v, offset),
		pe: (v: number[], offset: number, destOffset: number): number => {
			const size = 4 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeInt32LE(v[i], destOffset + 4 * i);
			});

			return size;
		},
		f: (v: bigint, offset: number): number => buf.writeBigInt64BE(v, offset),
		pf: (v: bigint[], offset: number, destOffset: number): number => {
			const size = 8 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeBigInt64BE(v[i], destOffset + 8 * i);
			});

			return size;
		},
		g: (v: bigint, offset: number): number => buf.writeBigInt64LE(v, offset),
		pg: (v: bigint[], offset: number, destOffset: number): number => {
			const size = 8 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeBigInt64LE(v[i], destOffset + 8 * i);
			});

			return size;
		},
		h: (v: number, offset: number): number => buf.writeUInt8(v, offset),
		ph: (v: number[], offset: number, destOffset: number): number => {
			const size = v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeUInt8(v[i], destOffset + i);
			});

			return size;
		},
		i: (v: number, offset: number): number => buf.writeUInt16BE(v, offset),
		pi: (v: number[], offset: number, destOffset: number): number => {
			const size = 2 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeUInt16BE(v[i], destOffset + 2 * i);
			});

			return size;
		},
		j: (v: number, offset: number): number => buf.writeUInt16LE(v, offset),
		pj: (v: number[], offset: number, destOffset: number): number => {
			const size = 2 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeUInt16LE(v[i], destOffset + 2 * i);
			});

			return size;
		},
		k: (v: number, offset: number): number => buf.writeUInt32BE(v, offset),
		pk: (v: number[], offset: number, destOffset: number): number => {
			const size = 4 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeUInt32BE(v[i], destOffset + 4 * i);
			});

			return size;
		},
		l: (v: number, offset: number): number => buf.writeUInt32LE(v, offset),
		pl: (v: number[], offset: number, destOffset: number): number => {
			const size = 4 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeUInt32LE(v[i], destOffset + 4 * i);
			});

			return size;
		},
		m: (v: bigint, offset: number): number => buf.writeBigUInt64BE(v, offset),
		pm: (v: bigint[], offset: number, destOffset: number): number => {
			const size = 8 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeBigUInt64BE(v[i], destOffset + 8 * i);
			});

			return size;
		},
		n: (v: bigint, offset: number): number => buf.writeBigUInt64LE(v, offset),
		pn: (v: bigint[], offset: number, destOffset: number): number => {
			const size = 8 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeBigUInt64LE(v[i], destOffset + 8 * i);
			});

			return size;
		},
		o: (v: number, offset: number): number => buf.writeFloatBE(v, offset),
		po: (v: number[], offset: number, destOffset: number): number => {
			const size = 4 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeFloatBE(v[i], destOffset + 4 * i);
			});

			return size;
		},
		p: (v: number, offset: number): number => buf.writeFloatLE(v, offset),
		pp: (v: number[], offset: number, destOffset: number): number => {
			const size = 4 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeFloatLE(v[i], destOffset + 4 * i);
			});

			return size;
		},
		q: (v: number, offset: number): number => buf.writeDoubleBE(v, offset),
		pq: (v: number[], offset: number, destOffset: number): number => {
			const size = 8 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeDoubleBE(v[i], destOffset + 8 * i);
			});

			return size;
		},
		r: (v: number, offset: number): number => buf.writeDoubleLE(v, offset),
		pr: (v: number[], offset: number, destOffset: number): number => {
			const size = 8 * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeDoubleLE(v[i], destOffset + 8 * i);
			});

			return size;
		},
		s: (v: number, offset: number, len: number): number => buf.writeIntBE(v, offset, len),
		ps: (v: number[], offset: number, len: number, destOffset: number) => {
			const size = len * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeIntBE(v[i], destOffset + len * i, len);
			});

			return size;
		},
		t: (v: number, offset: number, len: number): number => buf.writeIntLE(v, offset, len),
		pt: (v: number[], offset: number, len: number, destOffset: number) => {
			const size = len * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeIntLE(v[i], destOffset + len * i, len);
			});

			return size;
		},
		u: (v: number, offset: number, len: number): number => buf.writeUIntBE(v, offset, len),
		pu: (v: number[], offset: number, len: number, destOffset: number) => {
			const size = len * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeUIntBE(v[i], destOffset + len * i, len);
			});

			return size;
		},
		v: (v: number, offset: number, len: number): number => buf.writeUIntLE(v, offset, len),
		pv: (v: number[], offset: number, len: number, destOffset: number) => {
			const size = len * v.length;

			setPointer(buf, offset, destOffset, size);
			v.forEach((_, i) => {
				buf.writeUIntLE(v[i], destOffset + len * i, len);
			});

			return size;
		},
		w: (v: string, offset: number, len: number, _destOffset: number, encoding: Encoding): number =>
			buf.write(v, offset, len, encoding),
		pw: (v: string, offset: number, len: number, destOffset: number, encoding: Encoding): number =>
			bufferWriteCstringP(buf, offset, destOffset, v, len, encoding),
	};
}

export function readValue<T = number | bigint>(compiledDef: CompiledRecordDef, buf: Buffer, path: string): T {
	const funcs = getReadFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	return funcs[type](offset, size);
}

export function readString(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	encoding?: Encoding
): ReturnType<typeof bufferReadCstring> {
	const funcs = getReadFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (type !== TYPES.cstring && type !== TYPES.cstring_p) {
		throw new TypeError('Not a string');
	}

	return funcs[type](offset, size, encoding);
}

export function writeValue<T = number | bigint>(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	value: T
): void {
	const funcs = getWriteFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (isPointerType(type)) {
		throw new Error('Cannot write to a pointer');
	}

	// 0 is a dummy value for headOffset
	funcs[type](value, offset, size, 0);
}

export function writeString(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	value: string,
	encoding?: Encoding
): void {
	const funcs = getWriteFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (type !== TYPES.cstring) {
		throw new TypeError('Not a string');
	}

	// Zero the buffer section before writing to make sure the string will be
	// null-terminated.
	buf.fill(0, offset, offset + size);

	// 0 is a dummy value for heapOffset
	return funcs[type](value, offset, size, 0, encoding);
}

export function createReader(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string
): () => ReturnType<BufferReadFunction> {
	const funcs = getReadFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	return (): ReturnType<BufferReadFunction> => funcs[type](offset, size);
}

export function createStringReader(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	encoding?: Encoding
): () => string | Buffer | null {
	const funcs = getReadFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (type !== TYPES.cstring && type !== TYPES.cstring_p) {
		throw new TypeError('Not a string');
	}

	return (): string | Buffer | null => funcs[type](offset, size, encoding);
}

export function createWriter(compiledDef: CompiledRecordDef, buf: Buffer, path: string): (value: any) => void {
	const funcs = getWriteFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (isPointerType(type)) {
		throw new Error('Writers are not supported for pointer types');
	}

	// 0 is a dummy value for headOffset
	return (value: any): void => funcs[type](value, offset, size, 0);
}

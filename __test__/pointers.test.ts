import { compile, createRecord, deserialize } from '../src/index';
import { TYPES, SIZES } from '../src/types';
import { WORD_SIZE } from '../src/mach';

describe('Test that pointer types are serialized correctly', () => {
	test('a null pointer', () => {
		const recordDef = [{ name: 'numbers', type: 'int8_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			numbers: null,
		});

		const offset = Number(buf.readBigUInt64LE(0));
		expect(offset).toBe(0);
	});

	test('a pointer to an int8 array', () => {
		const recordDef = [{ name: 'numbers', type: 'int8_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			numbers: [1, 2, 3],
		});

		const offset = Number(buf.readBigUInt64LE(0));
		expect(offset).toBe(2 * WORD_SIZE);

		const size = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size).toBe(3);

		const v1 = Number(buf.readInt8(2 * WORD_SIZE + 0));
		expect(v1).toBe(1);

		const v2 = Number(buf.readInt8(2 * WORD_SIZE + 1));
		expect(v2).toBe(2);

		const v3 = Number(buf.readInt8(2 * WORD_SIZE + 2));
		expect(v3).toBe(3);
	});

	test('a pointer to an int16_be array', () => {
		const recordDef = [{ name: 'numbers', type: 'int16_be_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			numbers: [1, 2, 3],
		});

		const offset = Number(buf.readBigUInt64LE(0));
		expect(offset).toBe(2 * WORD_SIZE);

		const size = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size).toBe(6);

		const v1 = Number(buf.readInt16BE(2 * WORD_SIZE + 0));
		expect(v1).toBe(1);

		const v2 = Number(buf.readInt16BE(2 * WORD_SIZE + 2));
		expect(v2).toBe(2);

		const v3 = Number(buf.readInt16BE(2 * WORD_SIZE + 4));
		expect(v3).toBe(3);
	});

	test('a pointer to an int32_le array', () => {
		const recordDef = [{ name: 'numbers', type: 'int32_le_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			numbers: [122355975, 244711950, 235050510],
		});

		const offset = Number(buf.readBigUInt64LE(0));
		expect(offset).toBe(2 * WORD_SIZE);

		const size = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size).toBe(3 * SIZES[TYPES.int32_le]);

		const v1 = Number(buf.readInt32LE(2 * WORD_SIZE + 0));
		expect(v1).toBe(122355975);

		const v2 = Number(buf.readInt32LE(2 * WORD_SIZE + 4));
		expect(v2).toBe(244711950);

		const v3 = Number(buf.readInt32LE(2 * WORD_SIZE + 8));
		expect(v3).toBe(235050510);
	});

	test('a pointer to an uint32_le array', () => {
		const recordDef = [{ name: 'numbers', type: 'uint32_le_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			numbers: [122355975, 2392195598, 235050510],
		});

		const offset = Number(buf.readBigUInt64LE(0));
		expect(offset).toBe(2 * WORD_SIZE);

		const size = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size).toBe(3 * SIZES[TYPES.uint32_le]);

		const v1 = Number(buf.readUInt32LE(2 * WORD_SIZE + 0));
		expect(v1).toBe(122355975);

		const v2 = Number(buf.readUInt32LE(2 * WORD_SIZE + 4));
		expect(v2).toBe(2392195598);

		const v3 = Number(buf.readUInt32LE(2 * WORD_SIZE + 8));
		expect(v3).toBe(235050510);
	});

	test('a pointer to an int64_le array', () => {
		const recordDef = [{ name: 'numbers', type: 'uint64_le_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			numbers: [BigInt('3122306873021878513'), BigInt('11665128381306721961')],
		});

		const offset = Number(buf.readBigUInt64LE(0));
		expect(offset).toBe(2 * WORD_SIZE);

		const size = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size).toBe(2 * SIZES[TYPES.uint64_le]);

		const v1 = buf.readBigUInt64LE(2 * WORD_SIZE + 0);
		expect(v1).toBe(BigInt('3122306873021878513'));

		const v2 = buf.readBigUInt64LE(2 * WORD_SIZE + 8);
		expect(v2).toBe(BigInt('11665128381306721961'));
	});

	test('a pointer to an float_le array', () => {
		const recordDef = [{ name: 'numbers', type: 'float_le_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			numbers: [8.5, 6.5],
		});

		const offset = Number(buf.readBigUInt64LE(0));
		expect(offset).toBe(2 * WORD_SIZE);

		const size = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size).toBe(2 * SIZES[TYPES.float_le]);

		const v1 = buf.readFloatLE(2 * WORD_SIZE + 0);
		expect(v1).toBe(8.5);

		const v2 = buf.readFloatLE(2 * WORD_SIZE + 4);
		expect(v2).toBe(6.5);
	});

	test('a pointer to an double_le array', () => {
		const recordDef = [{ name: 'numbers', type: 'double_le_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			numbers: [4.2, 6.9],
		});

		const offset = Number(buf.readBigUInt64LE(0));
		expect(offset).toBe(2 * WORD_SIZE);

		const size = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size).toBe(2 * SIZES[TYPES.double_le]);

		const v1 = buf.readDoubleLE(2 * WORD_SIZE + 0);
		expect(v1).toBe(4.2);

		const v2 = buf.readDoubleLE(2 * WORD_SIZE + 8);
		expect(v2).toBe(6.9);
	});

	test('a cstring_p is written correctly', () => {
		const recordDef = [{ name: 'str', type: 'cstring_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			str: 'hello world!',
		});

		const offset = buf.readBigUInt64LE(0);
		expect(offset).toBe(BigInt(2 * WORD_SIZE));

		const size = buf.readBigUInt64LE(WORD_SIZE);
		expect(size).toBe(BigInt('hello world!'.length));

		const str = buf.subarray(Number(offset), Number(offset) + Number(size)).toString('utf8');
		expect(str).toEqual('hello world!');
	});

	test('cstring_p NULL pointer', () => {
		const recordDef = [{ name: 'str', type: 'cstring_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			str: null,
		});

		const offset = buf.readBigUInt64LE(0);
		expect(offset).toBe(BigInt(0));

		const size = buf.readBigUInt64LE(WORD_SIZE);
		expect(size).toBe(BigInt(0));

		expect(buf.length).toBe(2 * WORD_SIZE);
	});

	test('a complex record with pointers is written correctly', () => {
		const recordDef = [
			{ name: 'str1', type: 'cstring_p' },
			{ name: 'num', type: 'int8' },
			{ name: 'str2', type: 'cstring_p' },
		];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			str1: 'hello',
			num: 13,
			str2: 'world',
		});

		const offset1 = Number(buf.readBigUInt64LE(0));
		expect(offset1).toBe(5 * WORD_SIZE);

		const size1 = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size1).toBe('hello'.length);

		const str1 = buf.subarray(offset1, offset1 + size1).toString('utf8');
		expect(str1).toEqual('hello');

		const num = buf.readInt8(2 * WORD_SIZE);
		expect(num).toBe(13);

		const offset2 = Number(buf.readBigUInt64LE(3 * WORD_SIZE));
		expect(offset2).toBe(5 * WORD_SIZE + 5 + 3);

		const size2 = Number(buf.readBigUInt64LE(4 * WORD_SIZE));
		expect(size2).toBe(5);

		const str2 = buf.subarray(offset2, offset2 + size2).toString('utf8');
		expect(str2).toBe('world');
	});

	test('multiple integer arrays are written correctly to heap', () => {
		const recordDef = [
			{ name: 'nums1', type: 'uint32_le_p' },
			{ name: 'nums2', type: 'int8_p' },
			{ name: 'nums3', type: 'uint64_be_p' },
		];
		const compiled = compile(recordDef, { align: true });
		const buf = createRecord(compiled, {
			nums1: [1, 2],
			nums2: [1, 2, 3],
			nums3: [BigInt('16045481047390994159')],
		});

		const offset1 = Number(buf.readBigUInt64LE(0));
		expect(offset1).toBe(3 * 2 * WORD_SIZE);

		const size1 = Number(buf.readBigUInt64LE(WORD_SIZE));
		expect(size1).toBe(2 * SIZES[TYPES.uint32_le]);

		const offset2 = Number(buf.readBigUInt64LE(2 * WORD_SIZE));
		expect(offset2).toBe(offset1 + size1);

		const size2 = Number(buf.readBigUInt64LE(3 * WORD_SIZE));
		expect(size2).toBe(3 * SIZES[TYPES.int8]);

		const offset3 = Number(buf.readBigUInt64LE(4 * WORD_SIZE));
		expect(offset3).toBe(compiled.align(offset2 + size2));

		const size3 = Number(buf.readBigUInt64LE(5 * WORD_SIZE));
		expect(size3).toBe(SIZES[TYPES.uint64_le]);
	});

	test('integers and doubles', () => {
		const compiled = compile([
			{ name: 'f1', type: 'int8' },
			{ name: 'f2', type: 'int8' },
			{ name: 'a', type: 'double_le_p' },
			{ name: 'b', type: 'double_le_p' },
			{ name: 'c', type: 'double_le_p' },
		]);
		const buf = createRecord(compiled, {
			f1: 1,
			f2: 0,
			a: null,
			b: null,
			c: [1.0, 7.0, 4.5, 8.2],
		});

		const offset1 = Number(buf.readBigUInt64LE(8));
		expect(offset1).toBe(0);

		const size1 = Number(buf.readBigUInt64LE(16));
		expect(size1).toBe(0);

		const offset3 = Number(buf.readBigUInt64LE(40));
		expect(offset3).toBe(compiled.align(2 + 3 * 2 * WORD_SIZE));

		const value3 = [
			buf.readDoubleLE(offset3),
			buf.readDoubleLE(offset3 + 8),
			buf.readDoubleLE(offset3 + 16),
			buf.readDoubleLE(offset3 + 24),
		];
		expect(value3).toEqual([1, 7, 4.5, 8.2]);
	});
});

describe('Test that pointer types are deserialized correctly', () => {
	test('a pointer to a uint8 array is deserialized correctly', () => {
		const recordDef = [{ name: 'numbers', type: 'uint8_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = Buffer.from('100000000000000003000000000000000102030000000000', 'hex');
		const obj = deserialize(compiled, buf);

		expect(obj).toEqual({ numbers: [1, 2, 3] });
	});

	test('a pointer to a uint32_le array is deserialized correctly', () => {
		const recordDef = [{ name: 'numbers', type: 'uint32_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = Buffer.from('10000000000000000c0000000000000007014b070e02968e0e96020e00000000', 'hex');
		const obj = deserialize(compiled, buf);

		expect(obj).toEqual({ numbers: [122355975, 2392195598, 235050510] });
	});

	test('a pointer to a uint64_le array is deserialized correctly', () => {
		const recordDef = [{ name: 'numbers', type: 'uint64_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = Buffer.from('10000000000000001000000000000000f1d03aee8ea9542ba9561d5375dce2a1', 'hex');
		const obj = deserialize(compiled, buf);

		expect(obj).toEqual({ numbers: [BigInt('3122306873021878513'), BigInt('11665128381306721961')] });
	});

	test('a pointer to a float_le array is deserialized correctly', () => {
		const recordDef = [{ name: 'numbers', type: 'float_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = Buffer.from('10000000000000000800000000000000000008410000d040', 'hex');
		const obj = deserialize(compiled, buf);

		expect(obj).toEqual({ numbers: [8.5, 6.5] });
	});

	test('a pointer to a double_le array is deserialized correctly', () => {
		const recordDef = [{ name: 'numbers', type: 'double_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = Buffer.from('10000000000000001000000000000000cdcccccccccc10409a99999999991b40', 'hex');
		const obj = deserialize(compiled, buf);

		expect(obj).toEqual({ numbers: [4.2, 6.9] });
	});

	test('a cstring_p is deserialized', () => {
		const recordDef = [{ name: 'str', type: 'cstring_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = Buffer.from('10000000000000000c0000000000000068656c6c6f20776f726c642100000000', 'hex');
		const obj = deserialize(compiled, buf);

		expect(obj).toEqual({ str: 'hello world!' });
	});

	test('a cstring_p null pointer is deserialized', () => {
		const recordDef = [{ name: 'str', type: 'cstring_p' }];
		const compiled = compile(recordDef, { align: true });
		const buf = Buffer.from('00000000000000000000000000000000', 'hex');
		const obj = deserialize(compiled, buf);

		expect(obj).toEqual({ str: null });
	});

	test('a complex record with pointers is deserialized correctly', () => {
		const recordDef = [
			{ name: 'str1', type: 'cstring_p' },
			{ name: 'num', type: 'int8' },
			{ name: 'str2', type: 'cstring_p' },
		];
		const compiled = compile(recordDef, { align: true });
		const buf = Buffer.from(
			'280000000000000005000000000000000d000000000000003000000000000000050000000000000068656c6c6f000000776f726c64000000',
			'hex'
		);
		const obj = deserialize(compiled, buf);

		expect(obj).toEqual({
			str1: 'hello',
			num: 13,
			str2: 'world',
		});
	});
});

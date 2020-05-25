import { compile, createRecord, deserialize } from '../src/index';
import { WORD_SIZE } from '../src/mach';

describe('Test that pointer types are serialized correctly', () => {
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
});

describe('Test that pointer types are deserialized correctly', () => {
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

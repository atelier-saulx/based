import { compile, createRecord } from '../src/index';
import { WORD_SIZE } from '../src/mach';

describe('Test that pointer types work', () => {
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

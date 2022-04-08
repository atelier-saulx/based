import { compile, createRecord } from '../src/index';

describe('Test that aligned serialization works correctly', () => {
	test('simple mixed struct', () => {
		const def = [
			{ name: 'a', type: 'int8' },
			{ name: 'b', type: 'int8' },
			{ name: 'c', type: 'uint32_be' },
			{ name: 'd', type: 'uint32_be' },
			{ name: 'e', type: 'int8' },
			{ name: 'f', type: 'uint64_be' },
		];
		const compiled = compile(def, { align: true });
		const buf = createRecord(compiled, {
			a: 1,
			b: 2,
			c: 0xfccccccf,
			d: 0xfddddddf,
			e: 5,
			f: BigInt('0xffffffffffffffff'),
		});

		expect(buf.length).toBe(24);
		expect(buf.toString('hex')).toBe('01020000fccccccffddddddf05000000ffffffffffffffff');
	});

	test('Simple struct serialization', () => {
		const def = compile([
			{ name: 'index', type: 'int32_le' },
			{ name: '$increment', type: 'int32_le' },
			{ name: '$default', type: 'int32_le' },
		]);
		const obj = createRecord(def, { index: 0x1234, $increment: 12, $default: 0x3412 });

		expect(obj.toString('hex')).toBe('341200000c00000012340000');
	});
});

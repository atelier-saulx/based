import { compile, createRecord, deserialize } from '../src/index';

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
});

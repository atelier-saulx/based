import { compile, createRecord } from '../src/index';

describe('Test that various kinds of arrays are serialized as expected', () => {
	test('int8[1]', () => {
		const def = [{ name: 'a', type: 'int8[1]' }];
		const compiled = compile(def);
		const buf = createRecord(compiled, {
			a: [1],
		});

		expect(buf.length).toBe(1);
		expect(buf.toString('hex')).toBe('01');
	});

	test('int8[2]', () => {
		const def = [{ name: 'a', type: 'int8[2]' }];
		const compiled = compile(def);
		const buf = createRecord(compiled, {
			a: [1, 2],
		});

		expect(buf.length).toBe(2);
		expect(buf.toString('hex')).toBe('0102');
	});

	test('cstring[2]', () => {
		const def = [{ name: 'a', type: 'cstring[2]', size: 10 }];
		const compiled = compile(def);
		const buf = createRecord(compiled, {
			a: ['hello', 'world'],
		});

		expect(buf.length).toBe(2 * 10);
		expect(buf.toString('utf8')).toBe('hello\0\0\0\0\0world\0\0\0\0\0');
	});
});

import { compile, createRecord, deserialize } from '../src/index';

test('deserialization can deconstruct the object', () => {
	const recordDef = [
		{ name: 'a', type: 'uint32_le' },
		{ name: 'b', type: 'int32_le' },
		{ name: 'c', type: 'int_le', size: 3 },
		{ name: 'd', type: 'int_le', size: 5 },
		{
			name: 'nested',
			type: 'record',
			def: [
				{ name: 'a', type: 'uint32_le' },
				{ name: 'b', type: 'uint32_le' },
			],
		},
		{
			name: 'x',
			type: 'record',
			def: [
				{ name: 'a', type: 'uint32_le' },
				{ name: 'y', type: 'record', def: [{ name: 'a', type: 'uint32_le' }] },
			],
		},
	];

	const compiled = compile(recordDef);

	const obj1 = {
		a: 4,
		b: -128,
		c: 10,
		d: 5,
		nested: {
			a: 5,
			b: 5,
		},
		x: {
			a: 5,
			y: {
				a: 5,
			},
		},
	};

	const buf = createRecord(compiled, obj1);
	const obj2 = deserialize(compiled, buf);

	expect(obj1).toEqual(obj2);
});

test('A string can be reconstructed', () => {
	const recordDef = [
		{ name: 'a', type: 'uint32_le' },
		{ name: 'firstName', type: 'cstring', size: 15 },
	];
	const obj = {
		a: 4,
		firstName: 'Olli',
	};

	const compiled = compile(recordDef);
	const buf = createRecord(compiled, obj);
	const deser = deserialize(compiled, buf);

	expect(deser.a).toBe(4);
	expect(deser.firstName.toString('utf8')).toBe('Olli');
});

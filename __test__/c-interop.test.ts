import CC from './util/cc';
import { compile, generateCHeader, deserialize, createRecord } from '../src';

const cc = new CC();

afterAll(() => {
	cc.clean();
});

test('The final size matches to C (1)', async () => {
	const def = [
		{ name: 'a', type: 'int8' },
		{ name: 'b', type: 'int16_le' },
		{ name: 'c', type: 'int32_le' },
		{ name: 'd', type: 'int8' },
	];
	const compiled = compile(def);
	const cHeader = generateCHeader(compiled, 'record');

	const code = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
${cHeader}

struct record record = {
	.a = 1,
	.b = 2,
	.c = 3,
	.d = 4,
};

int main(void)
{
	uint8_t * p = (uint8_t *)(&record);

	do {
		printf("%02x", *p);
	} while (++p < (uint8_t *)(&record) + sizeof(struct record));

	return 0;
}
`;

	await cc.compile(code);
	const buf = await cc.run();

	expect(buf).toHaveLength(12);
	expect(buf).toHaveLength(compiled.size);

	const obj = deserialize(compiled, buf);
	const expected = {
		a: 1,
		b: 2,
		c: 3,
		d: 4,
	};

	expect(obj).toEqual(expected);
});

test('The final size matches to C (2)', async () => {
	const def = [
		{ name: 'a', type: 'float_le' },
		{ name: 'b', type: 'int8[1]' },
	];
	const compiled = compile(def);
	const cHeader = generateCHeader(compiled, 'record');

	const code = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
${cHeader}

struct record record = {
	.a = 1,
	.b[0] = 2,
};

int main(void)
{
	uint8_t * p = (uint8_t *)(&record);

	do {
		printf("%02x", *p);
	} while (++p < (uint8_t *)(&record) + sizeof(struct record));

	return 0;
}
`;

	await cc.compile(code);
	const buf = await cc.run();

	expect(buf).toHaveLength(compiled.size);

	const obj = deserialize(compiled, buf);
	const expected = {
		a: 1,
		b: [2],
	};

	expect(obj).toEqual(expected);
});

test('The final size matches to C (3)', async () => {
	const def = [
		{ name: 'a', type: 'int16_le' },
		{ name: 'b', type: 'int8[3]' },
	];
	const compiled = compile(def);
	const cHeader = generateCHeader(compiled, 'record');

	const code = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
${cHeader}

struct record record = {
	.a = 1,
	.b = { 2, 3, 4 },
};

int main(void)
{
	uint8_t * p = (uint8_t *)(&record);

	do {
		printf("%02x", *p);
	} while (++p < (uint8_t *)(&record) + sizeof(struct record));

	return 0;
}
`;

	await cc.compile(code);
	const buf = await cc.run();

	expect(buf).toHaveLength(6);
	expect(buf).toHaveLength(compiled.size);

	const obj = deserialize(compiled, buf);
	const expected = {
		a: 1,
		b: [2, 3, 4],
	};

	expect(obj).toEqual(expected);
});

test('Well ordered record does not need padding', async () => {
	const def = [
		{ name: 'a', type: 'int8' },
		{ name: 'b', type: 'int8' },
		{ name: 'c', type: 'int16_le' },
		{ name: 'd', type: 'int32_le' },
	];
	const compiled = compile(def);
	const cHeader = generateCHeader(compiled, 'record');

	const code = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
${cHeader}

struct record record = {
	.a = 1,
	.b = 2,
	.c = 3,
	.d = 4,
};

int main(void)
{
	uint8_t * p = (uint8_t *)(&record);

	do {
		printf("%02x", *p);
	} while (++p < (uint8_t *)(&record) + sizeof(struct record));

	return 0;
}
`;

	await cc.compile(code);
	const buf = await cc.run();

	expect(buf).toHaveLength(8);
	expect(buf).toHaveLength(compiled.size);

	const obj = deserialize(compiled, buf);
	const expected = {
		a: 1,
		b: 2,
		c: 3,
		d: 4,
	};

	expect(obj).toEqual(expected);
});

test('Using string pointers produces expected results', async () => {
	const def = [
		{ name: 'flag', type: 'uint8' },
		{ name: 'stra', type: 'cstring_p' },
		{ name: 'strb', type: 'cstring_p' },
		{ name: 'strc', type: 'cstring_p' },
	];
	const compiled = compile(def);
	const cHeader = generateCHeader(compiled, 'record');

	const code = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
${cHeader}

struct record record;

int main(void)
{
	fread(&record, sizeof(record), 1, stdin);

	printf("%d\\n%zd\\n%zd\\n%zd\\n",
		   record.flag,
		   record.stra_len,
		   record.strb_len,
		   record.strc_len
	);
	printf("%p\\n%p\\n%p\\n",
		   record.stra,
		   record.strb,
		   record.strc
	);

	return 0;
}
`;

	await cc.compile(code);
	const input = createRecord(compiled, {
		flag: 1,
		stra: null,
		strc: 'abc',
	});
	const buf = await cc.run(input, 'utf8');
	const res = buf.toString().split('\n');

	expect(res[0]).toBe('1');
	expect(res[1]).toBe('0');
	expect(res[2]).toBe('0');
	expect(res[3]).toBe('3');
	expect(res[4]).toBe('(nil)');
	expect(res[5]).toBe('(nil)');
	expect(res[6]).toBe('0x38');
});

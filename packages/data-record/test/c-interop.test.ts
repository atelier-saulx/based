import CC from './util/cc.js'
import {
  compile,
  generateCHeader,
  deserialize,
  createRecord,
} from '../src/index.js'
import test from 'ava'

const cc = new CC()

test.afterEach(() => {
  cc.clean()
})

test.serial('The final size matches to C (1)', async (t) => {
  const def = [
    { name: 'a', type: 'int8' },
    { name: 'b', type: 'int16_le' },
    { name: 'c', type: 'int32_le' },
    { name: 'd', type: 'int8' },
  ]
  const compiled = compile(def)
  const cHeader = generateCHeader(compiled, 'record')

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
`
  await cc.compile(code)
  const buf = await cc.run()
  t.is(buf.length, 12)
  t.is(buf.length, compiled.size)
  const obj = deserialize(compiled, buf)
  const expected = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
  }
  t.deepEqual(obj, expected)
})

test.serial('The final size matches to C (2)', async (t) => {
  const def = [
    { name: 'a', type: 'float_le' },
    { name: 'b', type: 'int8[1]' },
  ]
  const compiled = compile(def)
  const cHeader = generateCHeader(compiled, 'record')

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
`

  await cc.compile(code)
  const buf = await cc.run()

  t.is(buf.length, compiled.size)

  const obj = deserialize(compiled, buf)
  const expected = {
    a: 1,
    b: [2],
  }

  t.deepEqual(obj, expected)
})

test.serial('The final size matches to C (3)', async (t) => {
  const def = [
    { name: 'a', type: 'int16_le' },
    { name: 'b', type: 'int8[3]' },
  ]
  const compiled = compile(def)
  const cHeader = generateCHeader(compiled, 'record')

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
`

  await cc.compile(code)
  const buf = await cc.run()

  t.is(buf.length, 6)
  t.is(buf.length, compiled.size)

  const obj = deserialize(compiled, buf)
  const expected = {
    a: 1,
    b: [2, 3, 4],
  }

  t.deepEqual(obj, expected)
})

test('Well ordered record does not need padding', async (t) => {
  const def = [
    { name: 'a', type: 'int8' },
    { name: 'b', type: 'int8' },
    { name: 'c', type: 'int16_le' },
    { name: 'd', type: 'int32_le' },
  ]
  const compiled = compile(def)
  const cHeader = generateCHeader(compiled, 'record')

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
`

  await cc.compile(code)
  const buf = await cc.run()

  t.is(buf.length, 8)
  t.is(buf.length, compiled.size)

  const obj = deserialize(compiled, buf)
  const expected = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
  }

  t.deepEqual(obj, expected)
})

test.serial('Using string pointers produces expected results', async (t) => {
  const def = [
    { name: 'flag1', type: 'uint8' },
    { name: 'flag2', type: 'uint8' },
    { name: 'stra', type: 'cstring_p' },
    { name: 'strb', type: 'cstring_p' },
    { name: 'strc', type: 'cstring_p' },
  ]
  const compiled = compile(def)
  const cHeader = generateCHeader(compiled, 'record')

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
		   record.flag1,
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
`

  await cc.compile(code)
  const strc =
    'abcabababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccbababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
  const input = createRecord(compiled, {
    flag1: 1,
    flag2: 2,
    stra: null,
    strc,
  })
  const buf = await cc.run(input, 'utf8')
  const res = buf.toString().split('\n')

  t.is(res[0], '1')
  t.is(res[1], '0')
  t.is(res[2], '0')
  t.is(res[3], `${strc.length}`)
  // t.is((res[4]),'(nil)');
  // t.is((res[5]),'(nil)');
  t.is(res[6], '0x38')
})

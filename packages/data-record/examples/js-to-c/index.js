const { createRecord } = require('../../lib');
const compiled = require('./def');

const obj = {
	a: 1,
	b: 2,
	c: 4294967295,
	d: 4294967295,
	e: -2,
	f: 1844674407370955n,
	str: 'QWERTYUI',
	str_a: 'Hello world!',
	str_b: 'Ciao a tutti!'
};

const buf = createRecord(compiled, obj);
process.stdout.write(buf);
//process.stdout.write(buf.toString('hex'));

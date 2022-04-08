const readline = require('readline');
const { deserialize } = require('../../lib');
const compiled = require('./def');

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (input) => {
	const obj = deserialize(compiled, Buffer.from(input, 'hex'));
	console.log(obj);
});

const { compile } = require('../../lib');

const recordDef = [
	{ name: 'a', type: 'int8' },
	{ name: 'b', type: 'int8' },
	{ name: 'c', type: 'uint32_be' },
	{ name: 'd', type: 'uint32_be' },
	{ name: 'e', type: 'int8' },
	{ name: 'f', type: 'uint64_be' },
	{ name: 'str', type: 'cstring', size: 10 },
	{ name: 'str_a', type: 'cstring_p' },
	{ name: 'str_b', type: 'cstring_p' },
];

module.exports = compile(recordDef, { align: true });

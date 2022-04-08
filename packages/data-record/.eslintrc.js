module.exports = {
	parser: '@typescript-eslint/parser',
	extends: ['prettier', 'plugin:prettier/recommended'],
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module',
	},
	rules: {
		'@typescript-eslint/camelcase': 'off',
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-use-before-define': 'off',
		'@typescript-eslint/no-empty-function': 'off',

		// TODO: check if we want to re-enable @OlliV
		eqeqeq: 'off',
		'no-unused-vars': 'off',
		'@typescript-eslint/no-unused-vars': 'off',
		camelcase: 'off',
		'no-useless-escape': 'off',
		'no-console': 'off',
		'no-unused-expressions': 'off',
		'prefer-const': 'off',
		'prefer-promise-reject-errors': 'off',
	},
};

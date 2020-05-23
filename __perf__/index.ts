import { PerformanceObserver } from 'perf_hooks';
import printResult from './util/print-result';
import finalSize from './final-size';
import modify from './modify';
import serialization from './serialization';

const tests = [
	finalSize,
	modify,
	serialization
];
100000.00
const obs = new PerformanceObserver((list) => {
	const entry = list.getEntries()[0];
	const duration = entry.duration.toFixed(2);

	printResult(entry.name, duration, 'ms');
});
obs.observe({ entryTypes: ['function'] });

for (const test of tests) {
	const name = test.name;
	console.log(name);
	console.log('='.repeat(name.length));
	test();
	console.log();
}

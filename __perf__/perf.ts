import { PerformanceObserver } from 'perf_hooks';
import modify from './modify';
import serialization from './serialization';

const tests = [
	modify,
	serialization
];
100000.00
const obs = new PerformanceObserver((list) => {
	const entry = list.getEntries()[0];
	const duration = `${entry.duration.toFixed(2)}`;
	console.log(`${entry.name.padEnd(40)} ${duration.padStart(11)} ms`);
});
obs.observe({ entryTypes: ['function'] });

for (const test of tests) {
	const name = test.name;
	console.log(name);
	console.log('='.repeat(name.length));
	test();
	console.log();
}

import { PerformanceObserver } from 'perf_hooks';
import modify from './modify';
import serialization from './serialization';

const tests = [
	modify,
	serialization
];

const obs = new PerformanceObserver((list) => {
	const entry = list.getEntries()[0];
	console.log(`${entry.name}: ${entry.duration} ms`);
});
obs.observe({ entryTypes: ['function'] });

for (const test of tests) {
	const name = test.name;
	console.log(name);
	console.log('='.repeat(name.length));
	test();
	console.log();
}

type Predicate = (x: any) => boolean;
type Func = (x: any) => any;

const matched = (x: any) => ({
	on: () => matched(x),
	otherwise: () => x
});

const match = (x: any) => ({
	on: (pred: Predicate, fn: Func) => (pred(x) ? matched(fn(x)) : match(x)),
	otherwise: (fn: Func) => fn(x)
});

export default match;

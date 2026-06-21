export class LinearError extends Error {
	public override name = LinearError.name;

	public constructor(public data: unknown) {
		super('Linear Response Error');
	}
}

export class LinearTimedOutError extends Error {
	public override name = LinearTimedOutError.name;

	public constructor() {
		super('Timed Out');
	}
}

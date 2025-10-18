export class KatacutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "KatacutError";
	}
}

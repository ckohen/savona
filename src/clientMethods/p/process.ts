import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';

export class SavonaPProcess {
	public constructor(public client: SavonaClient) {}

	public async execute(options: SavonaRequestOptions) {
		return this.client.request('P.Process.Execute', options);
	}
}

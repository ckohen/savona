import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';

export class SavonaSystemLogs {
	public constructor(public client: SavonaClient) {}

	public async save(options: SavonaRequestOptions) {
		return this.client.request('System.Logs.Save', options);
	}
}

import type { SavonaClient, SavonaRequestOptions } from '../savona.js';

export class SavonaCapability {
	public constructor(public client: SavonaClient) {}

	public async getValue(options: SavonaRequestOptions<[string[]]>) {
		return this.client.request('Capability.GetValue', options);
	}
}

import type { SavonaClient, SavonaRequestOptions } from '../savona.js';

export class SavonaNotify {
	public constructor(public client: SavonaClient) {}

	public async subscribe(options: SavonaRequestOptions<[string[]]>) {
		return this.client.request('Notify.Subscribe', options);
	}

	public async unsubscribe(options: SavonaRequestOptions<[string[]]>) {
		return this.client.request('Notify.Unsubscribe', options);
	}
}

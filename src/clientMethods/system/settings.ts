import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';

export class SavonaSystemSettings {
	public constructor(public client: SavonaClient) {}

	public async reset(options: SavonaRequestOptions) {
		return this.client.request('System.Settings.Reset', options);
	}

	public async save(options: SavonaRequestOptions) {
		return this.client.request('System.Settings.Save', options);
	}

	public async load(options: SavonaRequestOptions) {
		return this.client.request('System.Settings.Load', options);
	}
}

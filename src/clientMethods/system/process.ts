import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';

export class SavonaSystemProcess {
	public constructor(public client: SavonaClient) {}

	public async getList(options: SavonaRequestOptions) {
		return this.client.request('System.Process.GetList', options);
	}

	public async autoAdjust(options: SavonaRequestOptions<[string[]]>) {
		return this.client.request('System.Process.AutoAdjust', options);
	}

	public async abort(options: SavonaRequestOptions<[string[]]>) {
		return this.client.request('System.Process.Abort', options);
	}
}

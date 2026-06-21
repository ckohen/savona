import type { SavonaClient, SavonaRequestOptions } from '../savona.js';

export class SavonaButton {
	public constructor(public client: SavonaClient) {}

	public async sendKeys(options: SavonaRequestOptions<[string[]]>) {
		return this.client.request('Button.SendKeys', options);
	}
}

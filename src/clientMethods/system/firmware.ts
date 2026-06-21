import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';

export class SavonaSystemFirmware {
	public constructor(public client: SavonaClient) {}

	public async update(options: SavonaRequestOptions) {
		return this.client.request('System.Firmware.Update', options);
	}
}

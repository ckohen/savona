import type { SavonaClient, SavonaRequestOptions } from '../savona.js';

export class SavonaStorageDrive {
	public constructor(public client: SavonaClient) {}

	public async format(options: SavonaRequestOptions) {
		return this.client.request('Storage.Drive.Format', options);
	}

	public async eject(options: SavonaRequestOptions) {
		return this.client.request('Storage.Drive.Eject', options);
	}

	public async finalize(options: SavonaRequestOptions) {
		return this.client.request('Storage.Drive.Finalize', options);
	}
}

export class SavonaStorage {
	public drive: SavonaStorageDrive;

	public constructor(client: SavonaClient) {
		this.drive = new SavonaStorageDrive(client);
	}
}

import type { SavonaClient, SavonaRequestOptions } from '../savona.js';

export class SavonaNetworkWirelessWPS {
	public constructor(public client: SavonaClient) {}

	public async start(options: SavonaRequestOptions) {
		return this.client.request('Network.Wireless.WPS.Start', options);
	}
}

export class SavonaNetworkWireless {
	public wps: SavonaNetworkWirelessWPS;

	public constructor(client: SavonaClient) {
		this.wps = new SavonaNetworkWirelessWPS(client);
	}
}

export class SavonaNetwork {
	public wireless: SavonaNetworkWireless;

	public constructor(client: SavonaClient) {
		this.wireless = new SavonaNetworkWireless(client);
	}
}

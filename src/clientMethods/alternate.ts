import type { SavonaClient, SavonaRequestOptions } from '../savona.js';

export class SavonaAlternateAuthentication {
	public constructor(public client: SavonaClient) {}

	public async basic(options: SavonaRequestOptions) {
		return this.client.request('Alternate.Authentication.Basic', options);
	}

	public async getNonce(options: SavonaRequestOptions<never>) {
		return this.client.request('Alternate.Authentication.GetNonce', options) as Promise<{ nonce: string }>;
	}

	public async digest(options: SavonaRequestOptions<[{ cnonce: string; response: string }]>) {
		return this.client.request('Alternate.Authentication.Digest', options);
	}
}

export class SavonaAlternate {
	public authentication: SavonaAlternateAuthentication;

	public constructor(client: SavonaClient) {
		this.authentication = new SavonaAlternateAuthentication(client);
	}
}

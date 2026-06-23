import type { SavonaClient, SavonaRequestOptions } from '../savona.js';

export type SavonaPropertySelector = string[] | string | null;

export class SavonaProperty {
	public constructor(public client: SavonaClient) {}

	public async getStatus(options: SavonaRequestOptions<[Record<string, SavonaPropertySelector>]>) {
		return this.client.request('Property.GetStatus', options);
	}

	public async getValue(options: SavonaRequestOptions<[Record<string, SavonaPropertySelector>]>) {
		return this.client.request('Property.GetValue', options);
	}

	public async getBackupValue(options: SavonaRequestOptions) {
		return this.client.request('Property.GetBackupValue', options);
	}

	public async setValue(options: SavonaRequestOptions) {
		return this.client.request('Property.SetValue', options);
	}

	public async addValue(options: SavonaRequestOptions) {
		return this.client.request('Property.AddValue', options);
	}

	public async deleteValue(options: SavonaRequestOptions) {
		return this.client.request('Property.DeleteValue', options);
	}

	public async updateValue(options: SavonaRequestOptions) {
		return this.client.request('Property.UpdateValue', options);
	}

	public async getRequestInterval(options: SavonaRequestOptions) {
		return this.client.request('Property.GetRequestInterval', options);
	}
}

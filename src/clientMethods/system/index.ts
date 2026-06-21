import type { LinearRequestParams } from '../../protocol/linear.js';
import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';
import { SavonaSystemFirmware } from './firmware.js';
import { SavonaSystemLogs } from './logs.js';
import { SavonaSystemProcess } from './process.js';
import { SavonaSystemSettings } from './settings.js';

export * from './firmware.js';
export * from './logs.js';
export * from './process.js';
export * from './settings.js';

export class SavonaSystem {
	public firmware: SavonaSystemFirmware;

	public settings: SavonaSystemSettings;

	public logs: SavonaSystemLogs;

	public process: SavonaSystemProcess;

	public constructor(public client: SavonaClient) {
		this.firmware = new SavonaSystemFirmware(client);
		this.settings = new SavonaSystemSettings(client);
		this.logs = new SavonaSystemLogs(client);
		this.process = new SavonaSystemProcess(client);
	}

	public async getVersion(options?: SavonaRequestOptions) {
		const finalOptions = options ?? {};
		finalOptions.timeout ??= 3e3;
		return this.client.request('System.GetVersion', finalOptions);
	}

	public async reboot(options: SavonaRequestOptions) {
		return this.client.request('System.Reboot', options);
	}

	public async shutdown(options: SavonaRequestOptions) {
		return this.client.request('System.Shutdown', options);
	}

	public async factoryReset(options: SavonaRequestOptions) {
		return this.client.request('System.FactoryReset', options);
	}

	public async getProperties(options: SavonaRequestOptions<[LinearRequestParams[0]]>) {
		return this.client.request('System.GetProperties', options);
	}

	public async setProperties(options: SavonaRequestOptions) {
		return this.client.request('System.SetProperties', options);
	}

	public async incrementProperties(options: SavonaRequestOptions) {
		return this.client.request('System.IncrementProperties', options);
	}

	public async decrementProperties(options: SavonaRequestOptions) {
		return this.client.request('System.DecrementProperties', options);
	}

	public async getCapabilities(options: SavonaRequestOptions<[LinearRequestParams[0]]>) {
		return this.client.request('System.GetCapabilities', options);
	}
}

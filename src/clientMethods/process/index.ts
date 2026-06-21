import type { LinearRequestParams } from '../../protocol/linear.js';
import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';
import { SavonaProcessExecute } from './execute.js';

export * from './execute.js';

export class SavonaProcess {
	public execute: SavonaProcessExecute;

	public constructor(public client: SavonaClient) {
		this.execute = new SavonaProcessExecute(client);
	}

	public async getList(options: SavonaRequestOptions) {
		return this.client.request('Process.GetList', options);
	}

	public async abort(options: SavonaRequestOptions<[LinearRequestParams[0]]>) {
		return this.client.request('Process.Abort', options);
	}
}

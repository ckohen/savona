import type { LinearRequestParams } from '../../protocol/linear.js';
import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';

export class SavonaProcessExecute {
	public constructor(public client: SavonaClient) {}

	public async automaticAdjustment(options: SavonaRequestOptions<[LinearRequestParams[0]]>) {
		return this.client.request('Process.Execute.AutomaticAdjustment', options);
	}

	public async reacquisition(options: SavonaRequestOptions<[LinearRequestParams[0]]>) {
		return this.client.request('Process.Execute.Reacquisition', options);
	}
}

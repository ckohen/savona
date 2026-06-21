import type { SavonaClient } from '../../savona.js';
import { SavonaPProcess } from './process.js';

export * from './process.js';

export class SavonaP {
	public process: SavonaPProcess;

	public constructor(client: SavonaClient) {
		this.process = new SavonaPProcess(client);
	}
}

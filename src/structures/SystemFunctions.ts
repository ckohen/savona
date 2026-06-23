import type { SavonaClient } from '../savona.js';

function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export class SystemFunctions {
	public static readonly PropertyName = 'System.Function';

	public functions: Record<string, unknown> = {};

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(SystemFunctions.PropertyName, (data) => {
			this.functions = asRecord(data);
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({ params: [{ [SystemFunctions.PropertyName]: ['*'] }] });
		if (typeof response !== 'object' || response === null || !(SystemFunctions.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.functions = asRecord(response[SystemFunctions.PropertyName]);
		return this.functions;
	}
}

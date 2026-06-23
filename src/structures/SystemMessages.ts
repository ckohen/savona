import type { SavonaClient } from '../savona.js';

export interface SystemMessage {
	code: string;
	rawCode: string;
	type: 'error' | 'warning';
	value: unknown;
}

function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function formatMessageCode(rawCode: string, prefix: 'E' | 'W') {
	const pattern = prefix === 'E' ? /^E(?<category>..)(?<detail>...)/ : /^W(?<category>..)(?<detail>...)/;
	const match = pattern.exec(rawCode);
	return match?.groups?.category === undefined || match.groups.detail === undefined
		? rawCode
		: `${prefix}${match.groups.category}-${match.groups.detail}`;
}

function activeMessages(data: Record<string, unknown>, type: 'error' | 'warning') {
	const prefix = type === 'error' ? 'E' : 'W';
	const messages: SystemMessage[] = [];

	for (const [rawCode, value] of Object.entries(data)) {
		if (value === '') continue;

		const code = formatMessageCode(rawCode, prefix);
		if (type === 'error' && code.startsWith('E04-')) continue;

		messages.push({ code, rawCode, type, value });
	}

	return messages;
}

export class SystemMessages {
	public static readonly ErrorPropertyName = 'System.Error';

	public static readonly WarningPropertyName = 'System.Warning';

	public errors: Record<string, unknown> = {};

	public warnings: Record<string, unknown> = {};

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(SystemMessages.ErrorPropertyName, (data) => {
			this.errors = asRecord(data);
		});
		client.notifications.propertyValueChanged.on(SystemMessages.WarningPropertyName, (data) => {
			this.warnings = asRecord(data);
		});
	}

	public get activeMessages() {
		return [...activeMessages(this.errors, 'error'), ...activeMessages(this.warnings, 'warning')];
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [{ [SystemMessages.ErrorPropertyName]: ['*'], [SystemMessages.WarningPropertyName]: ['*'] }],
		});

		this.updateFromResponse(response);
		return this.activeMessages;
	}

	private updateFromResponse(response: unknown) {
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const values = response as Record<string, unknown>;
		if (SystemMessages.ErrorPropertyName in values) {
			this.errors = asRecord(values[SystemMessages.ErrorPropertyName]);
		}

		if (SystemMessages.WarningPropertyName in values) {
			this.warnings = asRecord(values[SystemMessages.WarningPropertyName]);
		}
	}
}

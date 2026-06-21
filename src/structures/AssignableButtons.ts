import type { SavonaClient } from '../savona.js';

export class AssignableButton {
	public constructor(
		private readonly manager: AssignableButtons,
		public id: number,
		public capability: string[],
		public value?: string,
		public status = false,
	) {}

	public async setValue(value: string) {
		await this.manager.setValue(this.id, value);
	}

	public async press() {
		await this.manager.press(this.id);
	}
}

export class AssignableButtons {
	public static readonly PropertyName = 'Button.Assign';

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public buttons = new Map<number, AssignableButton>();

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(AssignableButtons.PropertyName, async (data) => {
			this.setProperties(data as Record<string, [string, 'Off' | 'On']>);
			await this.fetchStatus();
		});
		client.notifications.propertyValueChanged.on('P.Control.ProxyRec.StartStop', async () => {
			await this.fetchStatus();
		});
		client.notifications.propertyValueChanged.on('ProxyRecStartStop', async () => {
			await this.fetchStatus();
		});
	}

	public async press(buttonId: number) {
		await this.client.button.sendKeys({ params: [[`Assignable.${buttonId + 1}`]] });
	}

	public async fetchValues() {
		const response = await this.client.property.getValue({
			params: [{ [AssignableButtons.PropertyName]: ['*'] }],
		});
		if (typeof response !== 'object' || response === null || !(AssignableButtons.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.setProperties(response[AssignableButtons.PropertyName] as Record<string, [string, 'Off' | 'On']>);
	}

	public async setValue(target: number, value: string) {
		await this.client.property.setValue({
			params: [{ 'Button.Assign': { [`Assignable.${target}`]: [value, 'None'] } }],
		});
	}

	public async fetchCapabilities() {
		const response = await this.client.capability.getValue({ params: [[AssignableButtons.PropertyName]] });
		if (typeof response !== 'object' || response === null || !(AssignableButtons.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.setList(response['Button.Assign'] as Record<string, [boolean, string, string[]]>);
		return this.buttons;
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({ params: [{ 'P.Control.ProxyRec.StartStop': null }] });
		if (
			typeof response !== 'object' ||
			response === null ||
			!('P.Control.ProxyRec.StartStop' in response) ||
			!('ProxyRecStartStop' in response)
		) {
			throw new Error('Response does not match expected format');
		}

		this.status =
			response['P.Control.ProxyRec.StartStop'] === 'Locked' || response.ProxyRecStartStop === 'Locked'
				? 'Locked'
				: 'Unlocked';
		await this.fetchCapabilities();
		return this.status;
	}

	private setProperties(data: Record<string, [string, 'Off' | 'On']>) {
		for (const [key, value] of Object.entries(data)) {
			const id = Number(key.replace('Assignable.', ''));
			if (Number.isNaN(id)) continue;
			const existing = this.buttons.get(id);
			if (existing) {
				existing.value = value[0];
				existing.status = value[1] === 'On';
			} else {
				this.buttons.set(id, new AssignableButton(this, id, [], value[0], value[1] === 'On'));
			}
		}
	}

	private setList(data: Record<string, [boolean, string, string[]]>) {
		for (const [key, value] of Object.entries(data)) {
			const id = Number(key.replace('Assignable.', ''));
			if (Number.isNaN(id)) continue;
			const existing = this.buttons.get(id);
			if (existing) {
				existing.capability = value[2];
			}

			this.buttons.set(id, new AssignableButton(this, id, value[2], value[1]));
		}
	}
}

import type { SavonaClient } from '../savona.js';

export const enum AudioLevel {
	NegativeInfinitydB = 0,
	Negative60dB = 1,
	Negative40dB = 2,
	Negative20dB = 3,
	Unity = 4,
}

export class AudioChannel {
	public constructor(
		public channel: number,
		public level: AudioLevel,
	) {}
}

export class Audio {
	public static readonly PropertyName = 'Output.Audio.Level';

	public channels = new Map<1 | 2 | 3 | 4, AudioLevel>(
		[0, 0, 0, 0].map((level, index) => [(index + 1) as 1 | 2 | 3 | 4, level as AudioLevel]),
	);

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(Audio.PropertyName, async (data) => {
			for (const [channel, level] of Object.entries(data as Record<string, number>)) {
				this.channels.set(Number(channel.replace('ch.', '')) as 1 | 2 | 3 | 4, level as AudioLevel);
			}
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({ params: [{ [Audio.PropertyName]: ['*'] }] });
		if (typeof response !== 'object' || response === null || !(Audio.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		for (const [channel, level] of Object.entries(response[Audio.PropertyName] as Record<string, number>)) {
			this.channels.set(Number(channel.replace('ch.', '')) as 1 | 2 | 3 | 4, level as AudioLevel);
		}

		return response[Audio.PropertyName] as 'Automatic' | 'Manual';
	}

	public async setValue(value: 'Automatic' | 'Manual') {
		await this.client.property.setValue({ params: [{ [Audio.PropertyName]: value }] });
	}
}

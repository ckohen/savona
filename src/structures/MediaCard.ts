import type { SavonaClient } from '../savona.js';

interface SavonaFile {
	componentUri?: string;
	driveId: 1 | 2 | 3;
	materialUri?: string;
	name: string;
	relInfoUri?: string;
}

export class MediaCard {
	public writeProected = false;

	public isRecording = false;

	public isPlaying = false;

	public status: 'Mounted' | 'None' = 'None';

	public type: 'CFast' | 'SD' | 'Unknown' | 'XQD' = 'Unknown';

	public fileStatus: 'ManagementAreaDamaged' | 'Normal' = 'Normal';

	/**
	 * Available time in seconds
	 */
	public availableTime: number | null = null;

	/**
	 * Available size in bytes
	 */
	public availableSize: number | null = null;

	public constructor(
		private readonly manager: MediaCards,
		public id: number,
	) {}
}

export class MediaCards {
	public static readonly PropertyName = 'System.Storage';

	public static readonly ProtectedPropertyName = 'Storage.Media.WriteProtected';

	public static readonly DriveStatusPropertyName = 'Storage.Drive.Status';

	public static readonly DriveTypePropertyName = 'Storage.Drive.Type';

	public static readonly MediaStatusPropertyName = 'Storage.Media.File.Status';

	public static readonly AvailableTimePropertyName = 'Storage.Media.AvailableTime';

	public static readonly AvailableSizePropertyName = 'Storage.Media.AvailableSize';

	public cardA: MediaCard = new MediaCard(this, 1);

	public cardB: MediaCard = new MediaCard(this, 2);

	public cardC: MediaCard = new MediaCard(this, 3);

	public clipUploadFilesUploadDir: boolean = false;

	public putfileInCgi: boolean = true;

	public sdFileUpload: boolean = false;

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(MediaCards.PropertyName, async (data) => {
			if (typeof data !== 'object' || data === null) {
				return;
			}

			const playing = 'player' in data ? (data.player as string[]) : [];
			this.cardA.isPlaying = playing.includes('media.1');
			this.cardB.isPlaying = playing.includes('media.2');
			this.cardC.isPlaying = playing.includes('media.3');

			const recording = 'recorder' in data ? (data.recorder as string[]) : [];
			this.cardA.isRecording = recording.includes('media.1');
			this.cardB.isRecording = recording.includes('media.2');
			this.cardC.isRecording = recording.includes('media.3');
		});
		client.notifications.propertyValueChanged.on(MediaCards.ProtectedPropertyName, async (data) => {
			if (typeof data !== 'object' || data === null) {
				return;
			}

			if ('media.1' in data) {
				this.cardA.writeProected = data['media.1'] as boolean;
			}

			if ('media.2' in data) {
				this.cardB.writeProected = data['media.2'] as boolean;
			}

			if ('media.3' in data) {
				this.cardC.writeProected = data['media.3'] as boolean;
			}
		});
		client.notifications.propertyValueChanged.on(MediaCards.DriveStatusPropertyName, async (data) => {
			if (typeof data !== 'object' || data === null) {
				return;
			}

			if ('media.1' in data) {
				this.cardA.status = data['media.1'] as 'Mounted' | 'None';
			}

			if ('media.2' in data) {
				this.cardB.status = data['media.2'] as 'Mounted' | 'None';
			}

			if ('media.3' in data) {
				this.cardC.status = data['media.3'] as 'Mounted' | 'None';
			}
		});
		client.notifications.propertyValueChanged.on(MediaCards.DriveTypePropertyName, async (data) => {
			if (typeof data !== 'object' || data === null) {
				return;
			}

			if ('media.1' in data) {
				this.cardA.type = data['media.1'] as 'CFast' | 'SD' | 'Unknown' | 'XQD';
			}

			if ('media.2' in data) {
				this.cardB.type = data['media.2'] as 'CFast' | 'SD' | 'Unknown' | 'XQD';
			}

			if ('media.3' in data) {
				this.cardC.type = data['media.3'] as 'CFast' | 'SD' | 'Unknown' | 'XQD';
			}
		});
		client.notifications.propertyValueChanged.on(MediaCards.MediaStatusPropertyName, async (data) => {
			if (typeof data !== 'object' || data === null) {
				return;
			}

			if ('media.1' in data) {
				this.cardA.fileStatus = data['media.1'] as 'ManagementAreaDamaged' | 'Normal';
			}

			if ('media.2' in data) {
				this.cardB.fileStatus = data['media.2'] as 'ManagementAreaDamaged' | 'Normal';
			}

			if ('media.3' in data) {
				this.cardC.fileStatus = data['media.3'] as 'ManagementAreaDamaged' | 'Normal';
			}
		});
		client.notifications.propertyValueChanged.on(MediaCards.AvailableTimePropertyName, async (data) => {
			if (typeof data !== 'object' || data === null) {
				return;
			}

			if ('media.1' in data) {
				this.cardA.availableTime = data['media.1'] as number;
			}

			if ('media.2' in data) {
				this.cardB.availableTime = data['media.2'] as number;
			}

			if ('media.3' in data) {
				this.cardC.availableTime = data['media.3'] as number;
			}
		});
		client.notifications.propertyValueChanged.on(MediaCards.AvailableSizePropertyName, async (data) => {
			if (typeof data !== 'object' || data === null) {
				return;
			}

			if ('media.1' in data) {
				this.cardA.availableSize = data['media.1'] as number;
			}

			if ('media.2' in data) {
				this.cardB.availableSize = data['media.2'] as number;
			}

			if ('media.3' in data) {
				this.cardC.availableSize = data['media.3'] as number;
			}
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{
					[MediaCards.PropertyName]: ['*'],
					[MediaCards.ProtectedPropertyName]: ['*'],
					[MediaCards.DriveStatusPropertyName]: ['*'],
					[MediaCards.DriveTypePropertyName]: ['*'],
					[MediaCards.MediaStatusPropertyName]: ['*'],
					[MediaCards.AvailableTimePropertyName]: ['*'],
					[MediaCards.AvailableSizePropertyName]: ['*'],
				},
			],
		});

		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		if (MediaCards.PropertyName in response) {
			const propertyData = response[MediaCards.PropertyName] as Record<string, unknown>;
			const playing = 'player' in propertyData ? (propertyData.player as string[]) : [];
			this.cardA.isPlaying = playing.includes('media.1');
			this.cardB.isPlaying = playing.includes('media.2');
			this.cardC.isPlaying = playing.includes('media.3');

			const recording = 'recorder' in propertyData ? (propertyData.recorder as string[]) : [];
			this.cardA.isRecording = recording.includes('media.1');
			this.cardB.isRecording = recording.includes('media.2');
			this.cardC.isRecording = recording.includes('media.3');
		}

		if (MediaCards.ProtectedPropertyName in response) {
			const protectedData = response[MediaCards.ProtectedPropertyName] as Record<string, unknown>;
			if ('media.1' in protectedData) {
				this.cardA.writeProected = protectedData['media.1'] as boolean;
			}

			if ('media.2' in protectedData) {
				this.cardB.writeProected = protectedData['media.2'] as boolean;
			}

			if ('media.3' in protectedData) {
				this.cardC.writeProected = protectedData['media.3'] as boolean;
			}
		}

		if (MediaCards.DriveStatusPropertyName in response) {
			const driveStatusData = response[MediaCards.DriveStatusPropertyName] as Record<string, unknown>;
			if ('media.1' in driveStatusData) {
				this.cardA.status = driveStatusData['media.1'] as 'Mounted' | 'None';
			}

			if ('media.2' in driveStatusData) {
				this.cardB.status = driveStatusData['media.2'] as 'Mounted' | 'None';
			}

			if ('media.3' in driveStatusData) {
				this.cardC.status = driveStatusData['media.3'] as 'Mounted' | 'None';
			}
		}

		if (MediaCards.DriveTypePropertyName in response) {
			const driveTypeData = response[MediaCards.DriveTypePropertyName] as Record<string, unknown>;
			if ('media.1' in driveTypeData) {
				this.cardA.type = driveTypeData['media.1'] as 'CFast' | 'SD' | 'Unknown' | 'XQD';
			}

			if ('media.2' in driveTypeData) {
				this.cardB.type = driveTypeData['media.2'] as 'CFast' | 'SD' | 'Unknown' | 'XQD';
			}

			if ('media.3' in driveTypeData) {
				this.cardC.type = driveTypeData['media.3'] as 'CFast' | 'SD' | 'Unknown' | 'XQD';
			}
		}

		if (MediaCards.MediaStatusPropertyName in response) {
			const mediaStatusData = response[MediaCards.MediaStatusPropertyName] as Record<string, unknown>;
			if ('media.1' in mediaStatusData) {
				this.cardA.fileStatus = mediaStatusData['media.1'] as 'ManagementAreaDamaged' | 'Normal';
			}

			if ('media.2' in mediaStatusData) {
				this.cardB.fileStatus = mediaStatusData['media.2'] as 'ManagementAreaDamaged' | 'Normal';
			}

			if ('media.3' in mediaStatusData) {
				this.cardC.fileStatus = mediaStatusData['media.3'] as 'ManagementAreaDamaged' | 'Normal';
			}
		}

		if (MediaCards.AvailableTimePropertyName in response) {
			const availableTimeData = response[MediaCards.AvailableTimePropertyName] as Record<string, unknown>;
			if ('media.1' in availableTimeData) {
				this.cardA.availableTime = availableTimeData['media.1'] as number;
			}

			if ('media.2' in availableTimeData) {
				this.cardB.availableTime = availableTimeData['media.2'] as number;
			}

			if ('media.3' in availableTimeData) {
				this.cardC.availableTime = availableTimeData['media.3'] as number;
			}
		}

		if (MediaCards.AvailableSizePropertyName in response) {
			const availableSizeData = response[MediaCards.AvailableSizePropertyName] as Record<string, unknown>;
			if ('media.1' in availableSizeData) {
				this.cardA.availableSize = availableSizeData['media.1'] as number;
			}

			if ('media.2' in availableSizeData) {
				this.cardB.availableSize = availableSizeData['media.2'] as number;
			}

			if ('media.3' in availableSizeData) {
				this.cardC.availableSize = availableSizeData['media.3'] as number;
			}
		}

		return response;
	}

	public async uploadClips(files: SavonaFile[], destinationId: string, directory = '') {
		await this.client.clip.uploadFiles({
			params: [
				files.map((file) => [
					destinationId,
					`media.${file.driveId}`,
					file.name,
					[file.materialUri, file.componentUri, file.relInfoUri].filter(Boolean) as string[],
					{ absolute_dir: directory },
				]),
			],
		});
	}
}

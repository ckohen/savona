import { URL } from 'node:url';
import type { SavonaClient } from '../../savona.js';
import { MediaCard } from './MediaCard.js';
import { MediaClip } from './MediaClip.js';
import { parseMediaProfile } from './mediaProfile.js';
import type {
	CameraMediaDriveId,
	ClipReference,
	MediaDriveId,
	SavonaFile,
	UploadFileParam,
	UploadSettingReference,
} from './types.js';
import { uploadDirectoryParamFrom, uploadSettingIdParamFrom } from './utilities.js';

export class MediaCards {
	public static readonly PropertyName = 'System.Storage';

	public static readonly ProtectedPropertyName = 'Storage.Media.WriteProtected';

	public static readonly DriveStatusPropertyName = 'Storage.Drive.Status';

	public static readonly DriveTypePropertyName = 'Storage.Drive.Type';

	public static readonly MediaStatusPropertyName = 'Storage.Media.File.Status';

	public static readonly MediaProfileUrlPropertyName = 'Storage.Media.MediaProfileUrl';

	public static readonly AvailableTimePropertyName = 'Storage.Media.AvailableTime';

	public static readonly AvailableSizePropertyName = 'Storage.Media.AvailableSize';

	public static readonly FunctionPropertyName = 'System.Function';

	public cardA: MediaCard = new MediaCard(this, 1);

	public cardB: MediaCard = new MediaCard(this, 2);

	public cardC: MediaCard = new MediaCard(this, 3);

	public clipUploadFilesUploadDir: boolean = false;

	public putfileInCgi: boolean = true;

	public sdFileUpload: boolean = false;

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(MediaCards.PropertyName, (data) => this.updateStorage(data));
		client.notifications.propertyValueChanged.on(MediaCards.ProtectedPropertyName, (data) =>
			this.updateCards(data, (card, value) => {
				card.writeProtected = value as boolean;
			}),
		);
		client.notifications.propertyValueChanged.on(MediaCards.DriveStatusPropertyName, (data) =>
			this.updateCards(data, (card, value) => {
				card.status = value as string;
			}),
		);
		client.notifications.propertyValueChanged.on(MediaCards.DriveTypePropertyName, (data) =>
			this.updateCards(data, (card, value) => {
				card.type = value as 'CFast' | 'SD' | 'Unknown' | 'XQD';
			}),
		);
		client.notifications.propertyValueChanged.on(MediaCards.MediaStatusPropertyName, (data) =>
			this.updateCards(data, (card, value) => {
				card.fileStatus = value as 'ManagementAreaDamaged' | 'Normal';
			}),
		);
		client.notifications.propertyValueChanged.on(MediaCards.AvailableTimePropertyName, (data) =>
			this.updateCards(data, (card, value) => {
				card.availableTime = value as number;
			}),
		);
		client.notifications.propertyValueChanged.on(MediaCards.AvailableSizePropertyName, (data) =>
			this.updateCards(data, (card, value) => {
				card.availableSize = value as number;
			}),
		);
		client.notifications.propertyValueChanged.on(MediaCards.MediaProfileUrlPropertyName, (data) =>
			this.updateCards(data, (card, value) => {
				card.mediaProfileUrls = Array.isArray(value) ? (value as string[]) : [];
			}),
		);
		client.notifications.propertyValueChanged.on(MediaCards.FunctionPropertyName, (data) => this.updateFunctions(data));
	}

	public get cards() {
		return [this.cardA, this.cardB, this.cardC] as const;
	}

	public getCard(driveId: CameraMediaDriveId) {
		return this.cards.find((card) => card.driveId === driveId);
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
					[MediaCards.MediaProfileUrlPropertyName]: ['*'],
					[MediaCards.AvailableTimePropertyName]: ['*'],
					[MediaCards.AvailableSizePropertyName]: ['*'],
					[MediaCards.FunctionPropertyName]: ['*'],
				},
			],
		});

		this.updateFromResponse(response);
		return this.cards;
	}

	public async fetchClips(driveId: MediaDriveId) {
		const response = await this.client.property.getValue({
			params: [
				{
					[MediaCards.MediaProfileUrlPropertyName]: driveId,
					[MediaCards.DriveStatusPropertyName]: driveId,
				},
			],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const responseData = response as Record<string, unknown>;
		this.updateFromResponse(responseData);

		const statuses = responseData[MediaCards.DriveStatusPropertyName] as Record<string, unknown> | undefined;
		if (statuses?.[driveId] !== 'Mounted') {
			return [];
		}

		const urls = responseData[MediaCards.MediaProfileUrlPropertyName] as Record<string, unknown> | undefined;
		const profileUrls = urls?.[driveId];
		if (!Array.isArray(profileUrls) || typeof profileUrls[0] !== 'string') {
			return [];
		}

		const profileUrl = new URL(profileUrls[0], this.client.httpBaseURL).toString();
		const profileResponse = await this.client.fetch(profileUrl);
		if (!profileResponse.ok) {
			throw new Error(`Unable to fetch media profile ${profileUrl}: ${profileResponse.status} ${profileResponse.statusText}`);
		}

		const uriPrefix = driveId === 'extdisc' ? `ftp://${this.client.hostname}` : undefined;
		return (await parseMediaProfile(await profileResponse.text(), profileUrl, uriPrefix)).map(
			(clip) => new MediaClip(this, { ...clip, driveId }),
		);
	}

	public async fetchExternalClips() {
		return this.fetchClips('extdisc');
	}

	public async uploadClip(file: SavonaFile, uploadSetting: UploadSettingReference, directory?: string) {
		return this.uploadClips([file], uploadSetting, directory);
	}

	public async uploadClips(files: SavonaFile[], uploadSetting: UploadSettingReference, directory?: string) {
		const setting = this.uploadSettingWithCachedDefaults(uploadSetting);
		const uploadSettingId = uploadSettingIdParamFrom(setting);
		const uploadDirectory = uploadDirectoryParamFrom(setting, directory);
		const params: UploadFileParam[] = files.map((file) => [
			uploadSettingId,
			file.driveId ?? 'media.3',
			file.name,
			file instanceof MediaClip ? file.uploadUris : [...file.materialUris, ...(file.componentUris ?? []), ...(file.relInfoUris ?? [])],
			{ absolute_dir: uploadDirectory },
		]);

		return this.client.clip.uploadFiles({ params: [params] });
	}

	public canDeleteDrive(driveId: MediaDriveId) {
		return driveId === 'media.3';
	}

	public async deleteClip(driveId: MediaDriveId, name: string) {
		this.assertDeleteSupported(driveId);
		return this.client.clip.delete({ params: [driveId, name] });
	}

	public async deleteClips(driveId: MediaDriveId, clips: ClipReference[], onProgress?: (percentage: number, name: string) => void) {
		this.assertDeleteSupported(driveId);
		const names = clips.map((clip) => (typeof clip === 'string' ? clip : clip.name));
		const results: unknown[] = [];
		onProgress?.(0, names[0] ?? '');

		for (const [index, name] of names.entries()) {
			results.push(await this.deleteClip(driveId, name));
			onProgress?.(Math.trunc(((index + 1) / names.length) * 100), name);
		}

		return results;
	}

	private updateFromResponse(response: unknown) {
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const values = response as Record<string, unknown>;
		if (MediaCards.PropertyName in values) this.updateStorage(values[MediaCards.PropertyName]);
		if (MediaCards.ProtectedPropertyName in values) {
			this.updateCards(values[MediaCards.ProtectedPropertyName], (card, value) => {
				card.writeProtected = value as boolean;
			});
		}

		if (MediaCards.DriveStatusPropertyName in values) {
			this.updateCards(values[MediaCards.DriveStatusPropertyName], (card, value) => {
				card.status = value as string;
			});
		}

		if (MediaCards.DriveTypePropertyName in values) {
			this.updateCards(values[MediaCards.DriveTypePropertyName], (card, value) => {
				card.type = value as 'CFast' | 'SD' | 'Unknown' | 'XQD';
			});
		}

		if (MediaCards.MediaStatusPropertyName in values) {
			this.updateCards(values[MediaCards.MediaStatusPropertyName], (card, value) => {
				card.fileStatus = value as 'ManagementAreaDamaged' | 'Normal';
			});
		}

		if (MediaCards.MediaProfileUrlPropertyName in values) {
			this.updateCards(values[MediaCards.MediaProfileUrlPropertyName], (card, value) => {
				card.mediaProfileUrls = Array.isArray(value) ? (value as string[]) : [];
			});
		}

		if (MediaCards.AvailableTimePropertyName in values) {
			this.updateCards(values[MediaCards.AvailableTimePropertyName], (card, value) => {
				card.availableTime = value as number;
			});
		}

		if (MediaCards.AvailableSizePropertyName in values) {
			this.updateCards(values[MediaCards.AvailableSizePropertyName], (card, value) => {
				card.availableSize = value as number;
			});
		}

		if (MediaCards.FunctionPropertyName in values) this.updateFunctions(values[MediaCards.FunctionPropertyName]);
	}

	private updateStorage(data: unknown) {
		if (typeof data !== 'object' || data === null) return;

		const storage = data as Record<string, unknown>;
		const playing = Array.isArray(storage.player) ? (storage.player as string[]) : [];
		const recording = Array.isArray(storage.recorder) ? (storage.recorder as string[]) : [];

		for (const card of this.cards) {
			card.isPlaying = playing.includes(card.driveId);
			card.isRecording = recording.includes(card.driveId);
		}
	}

	private updateFunctions(data: unknown) {
		if (typeof data !== 'object' || data === null) return;

		const functions = data as Record<string, unknown>;
		this.clipUploadFilesUploadDir = functions.ClipUploadFilesUploadDir === true;
		this.putfileInCgi = (functions.PutfileInCgi ?? functions.PutfilelnCgi) === true;
		this.sdFileUpload = functions.SD_FileUpload === true;
	}

	private uploadSettingWithCachedDefaults(uploadSetting: UploadSettingReference) {
		if (typeof uploadSetting !== 'number') return uploadSetting;
		return this.client.uploadSettings.settings.get(uploadSetting) ?? uploadSetting;
	}

	private assertDeleteSupported(driveId: MediaDriveId) {
		if (!this.canDeleteDrive(driveId)) {
			throw new Error('Clip.Delete is only advertised for proxy media on media.3 by this camera remote API');
		}
	}

	private updateCards(data: unknown, update: (card: MediaCard, value: unknown) => void) {
		if (typeof data !== 'object' || data === null) return;

		const values = data as Record<string, unknown>;
		for (const card of this.cards) {
			if (card.driveId in values) {
				update(card, values[card.driveId]);
			}
		}
	}
}

import type { MediaCards } from './MediaCards.js';
import type { ClipReference, SavonaFile, UploadSettingReference } from './types.js';
import { mediaDriveIdFromNumber, withDefaultDriveId } from './utilities.js';

export class MediaCard {
	public availableSize: number | null = null;

	public availableTime: number | null = null;

	public fileStatus: 'ManagementAreaDamaged' | 'Normal' = 'Normal';

	public isPlaying = false;

	public isRecording = false;

	public mediaProfileUrls: string[] = [];

	public status = 'None';

	public type: 'CFast' | 'SD' | 'Unknown' | 'XQD' = 'Unknown';

	public writeProtected = false;

	public constructor(
		private readonly manager: MediaCards,
		public readonly slot: 1 | 2 | 3,
	) {}

	public get id() {
		return this.slot;
	}

	public get driveId() {
		return mediaDriveIdFromNumber(this.slot);
	}

	public get canDelete() {
		return this.manager.canDeleteDrive(this.driveId);
	}

	public async fetchValue() {
		await this.manager.fetchValue();
		return this;
	}

	public async fetchClips() {
		return this.manager.fetchClips(this.driveId);
	}

	public async uploadClips(clips: SavonaFile[], uploadSetting: UploadSettingReference, directory?: string) {
		return this.manager.uploadClips(
			clips.map((clip) => withDefaultDriveId(clip, this.driveId)),
			uploadSetting,
			directory,
		);
	}

	public async uploadClip(clip: SavonaFile, uploadSetting: UploadSettingReference, directory?: string) {
		return this.uploadClips([clip], uploadSetting, directory);
	}

	public async deleteClip(name: string) {
		return this.manager.deleteClip(this.driveId, name);
	}

	public async deleteClips(clips: ClipReference[], onProgress?: (percentage: number, name: string) => void) {
		return this.manager.deleteClips(this.driveId, clips, onProgress);
	}
}

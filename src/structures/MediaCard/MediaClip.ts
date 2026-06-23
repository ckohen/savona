import type { MediaCards } from './MediaCards.js';
import type { MediaClipData, MediaDriveId, UploadSettingReference } from './types.js';
import { mediaDurationSecondsFrom, mediaDurationTimecodeFrom } from './utilities.js';

export class MediaClip implements MediaClipData {
	public readonly audioType: string;

	public readonly componentUris: string[];

	public readonly driveId: MediaDriveId;

	public readonly duration: string;

	public readonly fps: string;

	public readonly materialType: string;

	public readonly materialUris: string[];

	public readonly name: string;

	public readonly proxyUris: string[];

	public readonly relInfoUris: string[];

	public readonly videoType: string;

	public constructor(
		private readonly manager: MediaCards,
		data: MediaClipData & { driveId: MediaDriveId },
	) {
		this.audioType = data.audioType;
		this.componentUris = data.componentUris ?? [];
		this.driveId = data.driveId;
		this.duration = data.duration;
		this.fps = data.fps;
		this.materialType = data.materialType;
		this.materialUris = data.materialUris;
		this.name = data.name;
		this.proxyUris = data.proxyUris ?? [];
		this.relInfoUris = data.relInfoUris ?? [];
		this.videoType = data.videoType;
	}

	public get card() {
		if (this.driveId === 'extdisc') return undefined;
		return this.manager.getCard(this.driveId);
	}

	public get canDelete() {
		return this.manager.canDeleteDrive(this.driveId);
	}

	public get uploadUris() {
		return [...this.materialUris, ...this.componentUris, ...this.relInfoUris];
	}

	public get durationFrames() {
		const frames = Number.parseInt(this.duration, 10);
		return Number.isNaN(frames) ? null : frames;
	}

	public get durationSeconds() {
		return mediaDurationSecondsFrom(this.duration, this.fps);
	}

	public get durationTimecode() {
		return mediaDurationTimecodeFrom(this.duration, this.fps);
	}

	public async upload(uploadSetting: UploadSettingReference, directory?: string) {
		return this.manager.uploadClip(this, uploadSetting, directory);
	}

	public async delete() {
		return this.manager.deleteClip(this.driveId, this.name);
	}

	public toJSON(): MediaClipData {
		return {
			audioType: this.audioType,
			componentUris: this.componentUris,
			driveId: this.driveId,
			duration: this.duration,
			fps: this.fps,
			materialType: this.materialType,
			materialUris: this.materialUris,
			name: this.name,
			proxyUris: this.proxyUris,
			relInfoUris: this.relInfoUris,
			videoType: this.videoType,
		};
	}
}

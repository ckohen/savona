import type { UploadSetting, UploadSettingId } from '../UploadSettings.js';
import type { MediaClip } from './MediaClip.js';

export type CameraMediaDriveId = 'media.1' | 'media.2' | 'media.3';
export type MediaDriveId = CameraMediaDriveId | 'extdisc';

export interface SavonaFile {
	componentUris?: string[];
	driveId?: MediaDriveId;
	materialUris: string[];
	name: string;
	proxyUris?: string[];
	relInfoUris?: string[];
}

export interface MediaClipData extends SavonaFile {
	audioType: string;
	duration: string;
	fps: string;
	materialType: string;
	videoType: string;
}

export type ClipReference = MediaClip | string;

export type UploadSettingReference = UploadSetting | UploadSettingId;

export type UploadFileParam = [
	uploadSettingId: string,
	driveId: MediaDriveId,
	name: string,
	uris: string[],
	uploadDir: { absolute_dir: string },
];

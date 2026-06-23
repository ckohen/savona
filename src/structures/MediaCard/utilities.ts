import type { CameraMediaDriveId, MediaDriveId, SavonaFile, UploadSettingReference } from './types.js';

export function mediaDriveIdFromNumber(id: 1 | 2 | 3): CameraMediaDriveId {
	return `media.${id}` as CameraMediaDriveId;
}

export function withDefaultDriveId(file: SavonaFile, driveId: MediaDriveId): SavonaFile {
	return {
		componentUris: file.componentUris,
		driveId: file.driveId ?? driveId,
		materialUris: file.materialUris,
		name: file.name,
		proxyUris: file.proxyUris,
		relInfoUris: file.relInfoUris,
	};
}

export function uploadSettingIdFrom(uploadSetting: UploadSettingReference) {
	return typeof uploadSetting === 'number' ? uploadSetting : uploadSetting.id;
}

export function uploadSettingIdParamFrom(uploadSetting: UploadSettingReference) {
	return String(uploadSettingIdFrom(uploadSetting));
}

export function uploadDirectoryParamFrom(uploadSetting: UploadSettingReference, directory?: string) {
	if (directory !== undefined) return directory;
	if (typeof uploadSetting === 'number') return '';

	return uploadSetting.option.transfer?.ftp_upload_dir ?? '';
}

function mediaFrameRateFactors(fps: string) {
	const match = /(?<frameRate>[\d.]+)(?<scanType>i|p)/i.exec(fps);
	if (match === null) return undefined;

	const { frameRate: frameRateText, scanType } = match.groups as { frameRate: string; scanType: string };
	const frameRate = Number.parseFloat(frameRateText);
	if (Number.isNaN(frameRate)) return undefined;

	return {
		displayFrameRate: frameRate > 30 ? frameRate / 2 : frameRate,
		secondsFrameRate: scanType.toLowerCase() === 'i' ? frameRate / 2 : frameRate,
	};
}

export function mediaDurationSecondsFrom(duration: string, fps: string) {
	const frames = Number.parseInt(duration, 10);
	const factors = mediaFrameRateFactors(fps);
	if (Number.isNaN(frames) || factors === undefined) return null;

	return frames / factors.secondsFrameRate;
}

export function mediaDurationTimecodeFrom(duration: string, fps: string) {
	const seconds = mediaDurationSecondsFrom(duration, fps);
	const factors = mediaFrameRateFactors(fps);
	if (seconds === null || factors === undefined) return 'Unknown';

	const hours = Math.trunc(seconds / 3_600);
	const minutes = Math.trunc((seconds - hours * 3_600) / 60);
	const wholeSeconds = Math.trunc(seconds - hours * 3_600 - minutes * 60);
	const frames = Math.trunc((seconds - Math.trunc(seconds)) * factors.displayFrameRate + 0.5);

	return [hours, minutes, wholeSeconds, frames].map((value) => String(value).padStart(2, '0')).join(':');
}

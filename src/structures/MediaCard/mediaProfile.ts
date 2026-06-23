import { Buffer } from 'node:buffer';
import { parseStringPromise } from 'xml2js';
import type { MediaClipData } from './types.js';

type XmlElement = Record<string, unknown> & { $?: Record<string, unknown> };

function asRecord(value: unknown): XmlElement {
	return typeof value === 'object' && value !== null ? (value as XmlElement) : {};
}

function children(element: XmlElement, name: string) {
	const value = element[name];
	return Array.isArray(value) ? value.map((childValue) => asRecord(childValue)) : [];
}

function child(element: XmlElement, name: string) {
	return children(element, name)[0] ?? {};
}

function attribute(element: XmlElement, name: string) {
	const value = element.$?.[name];
	return typeof value === 'string' ? value : undefined;
}

function mediaProfilePrefix(url: string) {
	const index = url.indexOf('MEDIAPRO.XML');
	return index === -1 ? url.slice(0, url.lastIndexOf('/') + 1) : url.slice(0, index);
}

function clipNameFromUri(uri: string) {
	const match = /^.+\/(?<name>.+)\.[^.]+$/.exec(uri);
	return match?.groups?.name ?? uri.split('/').at(-1) ?? uri;
}

function withPrefix(prefix: string, uri: string) {
	if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('ftp://')) {
		return uri;
	}

	return `${prefix}${uri}`;
}

function mediaProfileXmlFromResponse(responseText: string) {
	const trimmed = responseText.trim();
	if (trimmed.startsWith('<')) return trimmed;

	const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
	if (decoded.startsWith('<')) return decoded;

	return trimmed;
}

export async function parseMediaProfile(xml: string, profileUrl: string, uriPrefix = mediaProfilePrefix(profileUrl)) {
	const profile = asRecord(await parseStringPromise(mediaProfileXmlFromResponse(xml), { explicitRoot: false }));
	const properties = child(profile, 'Properties');
	const mediaKind = attribute(child(properties, 'Attached'), 'mediaKind') ?? attribute(properties, 'mediaKind');
	const clips: MediaClipData[] = [];

	for (const material of children(child(profile, 'Contents'), 'Material')) {
		const uri = attribute(material, 'uri');
		const materialType = attribute(material, 'type') ?? 'unknown';
		if (uri === undefined) continue;
		if (mediaKind === 'ProfessionalDisc' && materialType === 'PD-EDL') continue;

		const components = children(material, 'Component');
		if (components.length > 1) continue;

		const componentUri = components[0] === undefined ? undefined : attribute(components[0], 'uri');
		const relInfoUris = children(material, 'RelevantInfo')
			.map((element) => attribute(element, 'uri'))
			.filter((value): value is string => value !== undefined && !value.startsWith('file://') && !value.endsWith('.JPG'))
			.map((value) => withPrefix(uriPrefix, value));
		const proxyUris = children(material, 'Proxy')
			.map((element) => attribute(element, 'uri'))
			.filter((value): value is string => value !== undefined && !value.startsWith('file://'))
			.map((value) => withPrefix(uriPrefix, value));
		const mp4Element = components.find((element) => attribute(element, 'type') === 'MP4') ?? children(material, 'MP4')[0];

		clips.push({
			audioType: attribute(material, 'audioType') ?? (mp4Element === undefined ? undefined : attribute(mp4Element, 'audioType')) ?? 'unknown',
			componentUris: componentUri === undefined ? [] : [withPrefix(uriPrefix, componentUri)],
			driveId: undefined,
			duration: attribute(material, 'dur') ?? '',
			fps: attribute(material, 'fps') ?? '',
			materialType: materialType.toUpperCase(),
			materialUris: [withPrefix(uriPrefix, uri)],
			name: clipNameFromUri(uri),
			proxyUris,
			relInfoUris,
			videoType: attribute(material, 'videoType') ?? (mp4Element === undefined ? undefined : attribute(mp4Element, 'videoType')) ?? 'unknown',
		});
	}

	return clips;
}

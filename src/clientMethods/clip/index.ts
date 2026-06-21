import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';
import { SavonaClipPlayer } from './player.js';
import { SavonaClipRecorder } from './recorder.js';

export * from './player.js';
export * from './recorder.js';

export class SavonaClip {
	public player: SavonaClipPlayer;

	public recorder: SavonaClipRecorder;

	public constructor(public client: SavonaClient) {
		this.player = new SavonaClipPlayer(client);
		this.recorder = new SavonaClipRecorder(client);
	}

	public async getList(options: SavonaRequestOptions) {
		return this.client.request('Clip.GetList', options);
	}

	public async getThumbnailUrls(options: SavonaRequestOptions) {
		return this.client.request('Clip.GetThumbnailUrls', options);
	}

	public async copy(options: SavonaRequestOptions) {
		return this.client.request('Clip.Copy', options);
	}

	public async rename(options: SavonaRequestOptions) {
		return this.client.request('Clip.Rename', options);
	}

	public async move(options: SavonaRequestOptions) {
		return this.client.request('Clip.Move', options);
	}

	public async delete(options: SavonaRequestOptions) {
		return this.client.request('Clip.Delete', options);
	}

	public async upload(options: SavonaRequestOptions) {
		return this.client.request('Clip.Upload', options);
	}

	public async uploadFiles(
		options: SavonaRequestOptions<[[string, string, string, string[], { absolute_dir: string }][]]>,
	) {
		return this.client.request('Clip.UploadFiles', options);
	}

	public async download(options: SavonaRequestOptions) {
		return this.client.request('Clip.Download', options);
	}

	public async getTrimUnit(options: SavonaRequestOptions) {
		return this.client.request('Clip.GetTrimUnit', options);
	}

	public async getMediaProfileUrls(options: SavonaRequestOptions) {
		return this.client.request('Clip.GetMediaProfileUrls', options);
	}
}

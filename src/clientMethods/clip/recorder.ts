import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';

export class SavonaClipRecorder {
	public constructor(public client: SavonaClient) {}

	public async open(options: SavonaRequestOptions) {
		return this.client.request('Clip.Recorder.Open', options);
	}

	public async close(options: SavonaRequestOptions) {
		return this.client.request('Clip.Recorder.Close', options);
	}

	public async start(options: SavonaRequestOptions) {
		return this.client.request('Clip.Recorder.Start', options);
	}

	public async stop(options: SavonaRequestOptions) {
		return this.client.request('Clip.Recorder.Stop', options);
	}
}

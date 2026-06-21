import type { SavonaClient, SavonaRequestOptions } from '../../savona.js';

export class SavonaClipPlayer {
	public constructor(public client: SavonaClient) {}

	public async open(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.Open', options);
	}

	public async gotoClip(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.GotoClip', options);
	}

	public async close(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.Close', options);
	}

	public async start(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.Start', options);
	}

	public async stop(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.Stop', options);
	}

	public async pause(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.Pause', options);
	}

	public async fastForward(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.FastForward', options);
	}

	public async rewind(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.Rewind', options);
	}

	public async shuttle(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.Shuttle', options);
	}

	public async step(options: SavonaRequestOptions) {
		return this.client.request('Clip.Player.Step', options);
	}
}

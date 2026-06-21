import type { SavonaClient } from '../savona.js';

export class Buttons {
	public constructor(public client: SavonaClient) {}

	public async press(button: string) {
		await this.client.button.sendKeys({ params: [[button]] });
	}

	public async prev() {
		await this.press('Prev');
	}

	public async rewind() {
		await this.press('Rewind');
	}

	public async play() {
		await this.press('Play');
	}

	public async pause() {
		await this.press('Pause');
	}

	public async stop() {
		await this.press('Stop');
	}

	public async forward() {
		await this.press('Forward');
	}

	public async next() {
		await this.press('Next');
	}

	public async menu() {
		await this.press('Menu');
	}

	public async status() {
		await this.press('Status');
	}

	public async upArrow() {
		await this.press('UpArrow');
	}

	public async downArrow() {
		await this.press('DownArrow');
	}

	public async leftArrow() {
		await this.press('LeftArrow');
	}

	public async rightArrow() {
		await this.press('RightArrow');
	}

	public async set() {
		await this.press('Set');
	}

	public async cancel() {
		await this.press('Cancel');
	}

	public async thumbnail() {
		await this.press('Thumbnail');
	}

	public async option() {
		await this.press('Option');
	}
}

# Savona

Node.js library for talking to Sony PXW-Z190V cameras through the camera's Savona remote API.

This package is a lower-level controller wrapper. It exposes the camera's request methods and adds typed convenience structures for common camera state, settings, recording controls, media cards, uploads, and file-transfer jobs.

## Installation

```sh
yarn add @ckohen/savona
```

## Usage

```ts
import { SavonaClient, SavonaEvent } from '@ckohen/savona';

const client = new SavonaClient('camera.local', 'admin', 'password', {
	subscribeToNotifications: true,
});

client.on(SavonaEvent.Error, (message) => console.error(message));

await client.connect();

const status = await client.globalStatus.fetchValue();
const cards = await client.mediaCards.fetchValue();
const clips = await client.mediaCards.cardB.fetchClips();

await client.disconnect();
```

The client also exposes the raw Savona method groups when you need to work closer to the camera API:

```ts
await client.property.getValue({
	params: [{ 'System.Config': ['RemoteSetting'] }],
});

await client.clip.uploadFiles({
	params: [[['1001', 'media.2', '752_0437', ['http://camera/B/Clip/752_0437.MXF'], { absolute_dir: 'Archives' }]]],
});
```

## Structures

Most camera areas are available as properties on `SavonaClient`:

- Camera controls: `focus`, `iris`, `ND`, `shutter`, `gain`, `whiteBalance`, `slowAndQuick`, `colorBars`, `record`
- Status/config: `globalStatus`, `systemConfig`, `systemFunctions`, `deviceInfo`, `systemMessages`
- File handling: `mediaCards`, `uploadSettings`, `uploadJobs`, `autoUpload`
- Low-level method groups: `property`, `capability`, `process`, `system`, `clip`, `storage`, `button`, `notify`, `network`

Set methods send values to the camera and do not optimistically mutate local state. Fetch again, or listen for notifications, when you need confirmed camera state.

## Cache Updates And Connections

`SavonaEvent.CacheUpdate` identifies a structure whose automatic cache update has completed. Its argument is the typed `SavonaStructureName` union and matches the property on `client`. Read the existing structure to get the confirmed state:

```ts
import { SavonaEvent, type SavonaStructureName } from '@ckohen/savona';

function onCacheUpdate(structure: SavonaStructureName) {
	if (structure === 'uploadJobs') {
		console.log([...client.uploadJobs.jobs.values()], client.uploadJobs.summary);
	}
}

client.on(SavonaEvent.CacheUpdate, onCacheUpdate);

// During consumer cleanup:
client.off(SavonaEvent.CacheUpdate, onCacheUpdate);
await client.disconnect();
```

These events follow property-notification handlers, completed menu-event refreshes, and upload-job fetches. Handlers that fetch additional state emit after that work completes. A burst can update several structures or the same structure more than once; events identify completed updates rather than providing a complete snapshot of the camera. Raw notifications describe incoming traffic and do not guarantee cache refresh completion. For explicit fetches on other structures, await the fetch result directly.

`connect()` resolves after authentication and subscription setup succeed, and rejects on setup failure. Calling it while another connection attempt is in progress rejects. After an unexpected connection loss, the client retries automatically with delays increasing from 1 second to a maximum of 30 seconds. An explicit `disconnect()` cancels automatic retries and pending setup. Reconnect does not fetch every structure automatically; consumers should fetch the state they need after `SavonaEvent.Connect`.

Recent valid inbound WebSocket activity suppresses redundant health polls. Genuine check failures 1 and 2 use `SavonaEvent.Debug`; failure 3 and disconnect use `SavonaEvent.Error`. Notification and background-refresh errors also use `SavonaEvent.Error`, with a console fallback when no error listener is registered.

## Media And Uploads

Media cards are exposed as `cardA`, `cardB`, and `cardC`, corresponding to `media.1`, `media.2`, and `media.3`.

```ts
const clips = await client.mediaCards.cardB.fetchClips();
const settings = await client.uploadSettings.fetchValue();

const clip = clips[0];
const uploadSetting = settings.get(1001);

if (clip && uploadSetting) {
	await clip.upload(uploadSetting);
}
```

`fetchClips()` reads the camera's `MEDIAPRO.XML` media profile and handles the camera's digest-protected file server from Node, including the malformed HTTP headers sent by some camera firmware.

Upload setting IDs and upload job IDs are represented as numbers in this library, but are converted to strings for camera request parameters.

## File Deletion Caveat

The camera advertises remote clip deletion only for proxy media. The high-level delete helpers therefore only allow deletion from `media.3`:

```ts
if (clip.canDelete) {
	await clip.delete();
}
```

Main-file deletion from `media.1` or `media.2` is not exposed by the high-level wrapper. The raw `client.clip.delete(...)` method remains available for experiments, but tested name/path/URL forms returned `Invalid Argument` on a PXW-Z190V, and `System.Config.RemoteDeleteClip` normalized back to `type: ['proxy']`.

## Known Camera Behaviors

- Upload setting add/delete calls may return success while leaving the fixed camera slots unchanged, so this library exposes update/fetch behavior rather than add/remove helpers.
- Upload settings can use the saved FTP upload directory by passing an `UploadSetting` object, or by fetching settings first and then using a numeric setting ID.
- Some camera writes are eventually consistent; an immediate fetch may briefly return the previous value.
- The package has been live-tested against a PXW-Z190V, but other Sony cameras or firmware versions may expose different capability sets.

## Development

```sh
yarn install
yarn test
yarn lint
yarn build
```

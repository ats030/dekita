# Third-party code and data

No project-wide open-source reuse license has been selected for the original application code in this publication. The following third-party terms remain applicable to their respective files and dependencies.

## Bundled files

| Component | Files | Terms and attribution |
| --- | --- | --- |
| VOICEVOX speech, speaker ずんだもん (style ID 3) | `audio/*.mp3` (154 files, including the spoken animal sounds) | Generated with the VOICEVOX engine by `generate-voicevox-audio.cjs`. Credit: **VOICEVOX:ずんだもん**. In this repository's version the credit is shown on the title screen and in the README; the deployed app at dekita.ats030.workers.dev still predates the title-screen credit until it is redeployed. Use is subject to the [VOICEVOX terms](https://voicevox.hiroshiba.jp/term/) and the [ずんだもん voice library terms](https://zunko.jp/con_ongen_kiyaku.html). Reusing these audio files outside this application requires following those terms directly. |

Emoji in the interface are rendered by the viewer's system font; no emoji font or image is bundled.

## Installed dependencies

Development dependencies are installed separately with `npm ci` from `package-lock.json`; their packages and transitive notices are not repackaged here. The application itself loads no third-party JavaScript, fonts or external services at runtime.

Development dependencies reviewed on 2026-10-20: playwright and @playwright/test 1.62.1 (Apache-2.0), http-server 14.1.1 (MIT). Wrangler is used for deployment but is not a dependency of this repository; its review is kept in [tool-license-cloudflare.yaml](docs/tool-license-cloudflare.yaml). See the [publication license record](docs/publication-license-review.json) for version-specific evidence and restrictions.

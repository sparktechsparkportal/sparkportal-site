# SPARK Education Portal — public site

Built pages served at https://sparkportal.kr by GitHub Pages. Nothing here is hand-written: the source lives in the
private repository sparktechsparkportal/charlies-park-portal under sites-v17/portal-source.

- `/` — the portal (sample pages; `/?live=1` opens the owner's real portal after Google sign-in). Built by `npm run build:site`.
- `/sparkade/` — the pupils' SPARKADE page. It talks to the school's Apps Script through its gateway; pupils open it from
  their class link (`/sparkade?points=<class key>`) and sign in with their name and PIN. Same build.
- `/demo/` — the self-contained SPARKADE courtyard demo with invented pupils (`demo-presentation/build-demo.cjs`).

The pages carry only public addresses (the gateway URL and the public Google client ID). No pupil record, PIN, key or
credential is in this repository.

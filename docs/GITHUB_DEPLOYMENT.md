# GitHub deployment

Source: https://github.com/SASINDHAR/let-sride

Website: https://sasindhar.github.io/let-sride/

The `.github/workflows/deploy.yml` workflow installs dependencies, runs tests, builds the frontend with the Pages base path, and publishes `dist`. Push to `main` to deploy an update, or run the workflow manually from Actions. The repository's Pages source must be **GitHub Actions**.

For a local Pages build:

```sh
npm ci
npm test
npm run build -- --base=/let-sride/
npm start -- --base=/let-sride/
```

GPS road navigation works after the rider grants location access. Without Firebase configuration, group rides use the browser-local demo. GitHub Pages hosts the frontend; Firebase Authentication, Firestore, Storage, and Cloud Functions require the separate setup in README.md. To enable connected mode, add the public `VITE_FIREBASE_*` build configuration to the workflow and authorize `sasindhar.github.io` in Firebase Authentication and App Check. Never commit private server credentials or local environment files.

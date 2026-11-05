# Will Demo

Interactive frontend demo of the Will personal planning assistant.

Website: https://gthezi.github.io/will-demo/

This repository contains the built website for GitHub Pages. The React source
and product review documents are maintained separately.

- AI draft generation is simulated locally.
- Tasks, projects, and preferences are stored in each visitor's browser.
- Data is not shared between visitors or devices.

Source revision: `845b977`

To prepare an updated release, run this command in the source project's
`will-app` directory:

```powershell
npm.cmd run build -- --base=./ --outDir=../release/github-pages
```

Replace the previous build assets in this repository with the new output,
preserving `README.md` and `.nojekyll`, then commit and push to `main`.
GitHub Pages publishes from `main` at `/ (root)`.

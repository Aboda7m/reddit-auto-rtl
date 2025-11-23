# Reddit Auto RTL (posts & comments)

Auto-detect RTL text on Reddit and set direction/text-align for those blocks (posts, comments, inputs). Works on new.reddit.com and old.reddit.com. Uses MutationObserver for live content.

## Features

- Detects  Arabic and other RTL scripts
- Applies `direction: rtl` and `text-align: right` to posts, comments, titles and input fields when appropriate
- Preserves inline code and pre blocks so monospace alignment is not broken
- Live updates for dynamically loaded content
- Lightweight - no external dependencies

## Installation

1. Install a userscript manager like Tampermonkey, Greasemonkey, or Violentmonkey.
2. Create a new userscript and paste the contents of `reddit-auto-rtl.user.js`, or install the raw file if hosted.
3. Reload Reddit.

## Files

- `reddit-auto-rtl.user.js` - the userscript file
- `README.md` - this file
- `LICENSE` - MIT license

## Usage

- The script runs automatically on `https://*.reddit.com/*`.
- Input fields automatically flip direction while you type.
- If a container has an explicit `dir` attribute, the script will not override it.

## Contributing

- Fork, improve, open a pull request.
- Keep changes small and focused.
- If you add tests, include instructions and a test runner.

## Changelog

- 1.1.1 - Metadata updates and minor cleanup (author, license)
- 1.1 - Initial public release with robust RTL detection and MutationObserver
- 1.0 - Proof of concept

## License

MIT

## Author

Aboda7m (Abdulrahman Alnotefi)  
GitHub: `https://github.com/Aboda7m/reddit-auto-rtl`

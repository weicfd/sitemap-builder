# Sitemap crawler in JavaScript

A sitemap crawler would download the sitemap from the URL concated by the given URL and `sitemap.xml`.
And then fetch all links and images from the sites. Finally, store the results in a JSON file.

## How to run

```bash
> npm install
> node sitemap-builder.js www.google.com result.json

```

## Code Structure

* `package.json` : npm package.json
* `sitemap-builder.js` : core code
* `README.md` : this file
* `result.json` : sample result

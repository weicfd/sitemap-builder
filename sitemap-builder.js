const fetch = require("node-fetch");
const xml2js = require("xml2js-es6-promise");
const cheerio = require("cheerio");
const fs = require("fs");

const FETCH_TIMEOUT = 3000; // timeout in milliseconds
const timeoutTable = {}; // table of stored timeouts 
var output_file = "result.json"; // default output file name
const LEVEL_LIMIT = 10; // limit of crawler level

/**
 * Entry point for the application
 * @param {string} url the root url of the web page
 * @returns {Promise} Promise to resolve an array containing all the
 * sitemap url, links and images
 */
function getSiteMap(url) {
  // preprocess the url
  if (!/^https?:\/\//i.test(url)) {
    url = "http://" + url;
  }
  // set root url
  var root = new URL("/sitemap.xml", url);

  // fetch the sitemap json file
  return fetch(root.href)
    .then(function(response) {
      if (!response || response.status !== 200) {
        throw new Error("Error fetching sitemap file from " + url);
      }
      return response.text();
    })
    .then(() => {
      // start the crawler process
      return crawl(root.href);
    });
}

/**
 * Recursively fetch the sitemap
 * @param {string} url url to sitemap
 * @returns {Promise} Promise for the result
 */
function crawl(url) {
  // console.log("crawl:" + url);

  return new Promise(function(resolve) {
    timeoutTable[url] = setTimeout(function() {
      resolve([]);
    }, FETCH_TIMEOUT);
    fetch(url)
      .then(response => {
        if (!response || response.status !== 200) {
          return resolve([]);
        }
        clearTimeout(timeoutTable[url]);
        return response.text();
      })
      .then(xml => {
        return xml2js(xml).then(function(js) {
          return js;
        });
      })
      .then(data => {
        if (data && data.urlset && data.urlset.url) {
          const sites = data.urlset.url.slice(0, LEVEL_LIMIT).map(site =>
            getItemDetails(site.loc && site.loc[0])
          );
          return Promise.all(sites).then(results => {
            const items = results
              .filter(result => result != null)
              .reduce((acc, item) => acc.concat(item), []);
            return resolve([].concat(items));
          });
        } else if (data && data.sitemapindex) {
          const sitemap = data.sitemapindex.sitemap.map(
            sitemap => sitemap.loc && sitemap.loc[0]
          );
          const promiseArray = sitemap.slice(0, LEVEL_LIMIT).map(site => crawl(site));
          // when all promises are resolved then filter and reduce promise array
          return Promise.all(promiseArray).then(results => {
            const promises = results
              .filter(result => !result.error)
              .reduce((acc, item) => acc.concat(item), []);

            return resolve(promises);
          });
        }
        return resolve([]);
      })
      .catch(() => {
        return resolve([]);
      });
  });
}

/**
 * Give a promise that resolves with an object containing web page information
 * @param {string} url the url of the page
 * @returns {Promise} promise resolved with an object with following properties:
 * {
 *    page_url: string,
 *    links: Array<string>,
 *    images: Array<string>
 * }
 */
function getItemDetails(url) {
  return new Promise(function(resolve) {
    if (!url) {
      console.log("url is null");

      return resolve(null);
    }
    timeoutTable[url] = setTimeout(function() {
      resolve(null);
    }, FETCH_TIMEOUT);
    fetch(url)
      .then(response => response.text())
      .then(text => {
        clearTimeout(timeoutTable[url]);
        var $ = cheerio.load(text);
        var links = collectInternalLinks($);
        var imgs = collectImageLinks($);

        var result = {
          page_url: url,
          links: links,
          images: imgs
        };
        console.log("Collect from page:" + result.page_url);
        console.log("Collect " + links.length + " links");
        console.log("Collect " + imgs.length + " images");

        // fs.appendFile(output_file, JSON.stringify(result) + ",\n", error => {
        //   if (error) {
        //     console.log(error);
        //     return;
        //   }
        //   console.log("saved result");
        // });
        return resolve(result);
      })
      .catch(error => {
        console.log("fetch error");
        console.log(error);

        return resolve(null);
      });
  });
}

/**
 * Get a list of all links of the given web page
 * @param {object} $ cheerio context when a web page is loaded
 */
function collectInternalLinks($) {
  var allAbsoluteLinks = [];

  var absoluteLinks = $("a[href^='http']");
  absoluteLinks.each(function() {
    allAbsoluteLinks.push($(this).attr("href"));
  });
  return allAbsoluteLinks;
}

/**
 * Get a list of all imageLinks of the given web page
 * @param {object} $ cheerio context when a web page is loaded
 */
function collectImageLinks($) {
  var allImgeLinks = [];

  var imageLinks = $("img");
  imageLinks.each(function() {
    allImgeLinks.push($(this).attr("src"));
  });
  return allImgeLinks;
}

// main function
var args = process.argv;
if (args.length != 4) {
  console.log("Usage: node sitemap-builder.js {URL to crawl} {output file}");
  console.log("Example: node sitemap-builder.js www.google.com result.json");
  return;
}
var webUrl = args[2];
output_file = args[3];
// fs.writeFileSync(output_file, "["); // clear output
getSiteMap(webUrl)
  .then(response => {
    console.dir("finished crawl site");
    fs.writeFileSync(output_file, JSON.stringify(response));
    // fs.appendFileSync(output_file, "]");
  })
  .catch(error => {
    console.log(error);
    // fs.appendFileSync(output_file, "]");
  });

// test get details page
// getItemDetails("https://www.google.com").then(result => {
//   console.log(result);
// })

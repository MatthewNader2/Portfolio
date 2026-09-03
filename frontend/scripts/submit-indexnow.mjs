#!/usr/bin/env node
/**
 * IndexNow Submission Script
 * 
 * Submits all sitemap URLs to Bing, Yandex, and other IndexNow-participating
 * search engines (which includes DuckDuckGo via Bing's index).
 * 
 * Usage: node scripts/submit-indexnow.mjs
 * 
 * Note: Google does NOT participate in IndexNow. Use Google Search Console
 * to submit sitemaps to Google.
 */

const INDEXNOW_KEY = "4cf603a9bb6e4d6289f74915a492eac3";
const HOST = "matthew-nader.web.app";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;

// All URLs from sitemap
const URL_LIST = [
  `https://${HOST}/`,
  `https://${HOST}/about/`,
  `https://${HOST}/projects/autonomous-self-driving-agent/`,
  `https://${HOST}/projects/cpu-process-scheduler/`,
  `https://${HOST}/projects/coral-reef-health-monitoring/`,
  `https://${HOST}/projects/underwater-marine-debris/`,
  `https://${HOST}/projects/crab-shell-biometrics/`,
  `https://${HOST}/projects/3d-crt-terminal-portfolio/`,
  `https://${HOST}/projects/sudoku-rs-engine/`,
];

// IndexNow endpoints — submitting to one shares with all participants
// but submitting to multiple increases reliability
const ENDPOINTS = [
  { name: "IndexNow (shared)", url: "https://api.indexnow.org/indexnow" },
  { name: "Bing",              url: "https://www.bing.com/indexnow" },
  { name: "Yandex",            url: "https://yandex.com/indexnow" },
];

const payload = JSON.stringify({
  host: HOST,
  key: INDEXNOW_KEY,
  keyLocation: KEY_LOCATION,
  urlList: URL_LIST,
});

console.log(`\n🔍 IndexNow Submission`);
console.log(`   Host: ${HOST}`);
console.log(`   URLs: ${URL_LIST.length}`);
console.log(`   Key:  ${INDEXNOW_KEY}\n`);

for (const endpoint of ENDPOINTS) {
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: payload,
    });

    const status = res.status;
    const statusText = res.statusText;
    const icon = status === 200 || status === 202 ? "✅" : "⚠️";
    console.log(`${icon} ${endpoint.name}: ${status} ${statusText}`);

    if (status !== 200 && status !== 202) {
      const body = await res.text();
      console.log(`   Response: ${body.substring(0, 200)}`);
    }
  } catch (err) {
    console.log(`❌ ${endpoint.name}: ${err.message}`);
  }
}

console.log(`\n📋 Manual submission links:`);
console.log(`   Google Search Console: https://search.google.com/search-console`);
console.log(`   Bing Webmaster Tools:  https://www.bing.com/webmasters`);
console.log(`   Yandex Webmaster:      https://webmaster.yandex.com`);
console.log(`\n💡 DuckDuckGo uses Bing's index — submitting to Bing covers DuckDuckGo.\n`);

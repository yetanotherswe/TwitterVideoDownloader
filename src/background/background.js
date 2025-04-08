// Store the latest .m3u8 URL per tweet
let videoUrls = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 if (message.action === 'downloadVideo') {
 const { tweetId } = message;
 // Reset video URL for this tweet
 videoUrls[tweetId] = null;

 // Tell content script to wait for URL
 chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
 chrome.tabs.sendMessage(tabs[0].id, { action: 'waitingForVideo', tweetId });
 });
 } else if (message.action === 'startDownload') {
 const { url, filename } = message;
 chrome.downloads.download({
 url: url,
 filename: filename,
 saveAs: true // Prompt user to choose save location
 });
 }
});

// Intercept network requests for .m3u8 files
chrome.webRequest.onCompleted.addListener(
 (details) => {
 if (details.url.includes('.m3u8')) {
 // Fetch the master playlist to find the highest quality
 fetch(details.url)
 .then(response => response.text())
 .then(text => {
 const lines = text.split('\n');
 let highestQualityUrl = details.url;

 // Look for highest bandwidth in master playlist
 let maxBandwidth = 0;
 lines .forEach((line, index) => {
 if (line.includes('BANDWIDTH')) {
 const bandwidth = parseInt(line.match(/BANDWIDTH=(\d+)/)?.[1] || 0);
 if (bandwidth > maxBandwidth) {
 maxBandwidth = bandwidth;
 highestQualityUrl = lines[index + 1]; // Next line is the .m3u8 URL
 }
 }
 });

 // Send the highest quality URL back to content script
 chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
 chrome.tabs.sendMessage(tabs[0].id, {
 action: 'videoUrlFound',
 url: highestQualityUrl,
 tweetId: Object.keys(videoUrls)[0] // Simplistic; improve for multi-tweet
 });
 });
 })
 .catch(err => console.error('Error fetching .m3u8:', err));
 }
 },
 { urls: ['https://video.twimg.com/*'] }
);
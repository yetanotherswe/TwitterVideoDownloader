// background.js
let pendingDownloads = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadVideo') {
    const { tweetId } = message;
    pendingDownloads[tweetId] = true;
    
    // Tell content script we're waiting for the video
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'waitingForVideo', 
        tweetId 
      });
    });
  } 
  else if (message.action === 'videoFound') {
    const { videoUrl, tweetId } = message;
    
    if (pendingDownloads[tweetId]) {
      // Convert HLS to MP4 or use direct MP4 URL if available
      processVideoUrl(videoUrl, tweetId);
      delete pendingDownloads[tweetId]; // Clear pending state
    }
  }
  else if (message.action === 'startDownload') {
    const { url, filename } = message;
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true // Prompt user to choose save location
    });
  }
  return true; // Needed for async response
});

// Process video URL - either MP4 direct or handle m3u8
function processVideoUrl(url, tweetId) {
  // Check if it's already an MP4
  if (url.includes('.mp4')) {
    startDownload(url, tweetId);
    return;
  }
  
  // If it's an m3u8, fetch and find the highest quality segment
  if (url.includes('.m3u8')) {
    fetch(url)
      .then(response => response.text())
      .then(text => {
        // Look for direct MP4 links in the playlist
        const mp4Match = text.match(/https:\/\/[^"'\s]+\.mp4/);
        if (mp4Match) {
          startDownload(mp4Match[0], tweetId);
          return;
        }
        
        // If we can't find direct MP4, look for highest quality stream
        const variants = parseM3u8(text, url);
        if (variants.length > 0) {
          // Sort by bandwidth (highest first)
          variants.sort((a, b) => b.bandwidth - a.bandwidth);
          // Get the direct video URL if possible, otherwise inform user
          if (variants[0].url) {
            startDownload(variants[0].url, tweetId);
          } else {
            notifyUser("Couldn't extract direct video URL. Try using the developer tools method.");
          }
        }
      })
      .catch(err => {
        console.error('Error processing m3u8:', err);
        notifyUser("Error processing video. Please try again.");
      });
  }
}

// Parse m3u8 file to get variants
function parseM3u8(content, baseUrl) {
  const lines = content.split('\n');
  const variants = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('#EXT-X-STREAM-INF')) {
      const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
      const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;
      
      // Next line should be the segment URL
      if (i + 1 < lines.length && !lines[i+1].startsWith('#')) {
        let segmentUrl = lines[i+1].trim();
        
        // Handle relative URLs
        if (!segmentUrl.startsWith('http')) {
          const baseUrlObj = new URL(baseUrl);
          if (segmentUrl.startsWith('/')) {
            segmentUrl = `${baseUrlObj.origin}${segmentUrl}`;
          } else {
            // Remove the filename from the base URL
            const path = baseUrlObj.pathname.split('/').slice(0, -1).join('/');
            segmentUrl = `${baseUrlObj.origin}${path}/${segmentUrl}`;
          }
        }
        
        variants.push({
          bandwidth,
          url: segmentUrl
        });
      }
    }
  }
  
  return variants;
}

// Start the download process
function startDownload(url, tweetId) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'startDownload',
      url: url,
      tweetId: tweetId
    });
  });
}

// Notify the user of errors
function notifyUser(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'notifyUser',
      message: message
    });
  });
}

// WebRequest listener for video requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Listen for video file requests
    const url = details.url;
    
    // Check for direct video assets or manifests
    if ((url.includes('video.twimg.com') && 
        (url.includes('.mp4') || url.includes('.m3u8'))) || 
        url.includes('amplify_video')) {
      
      // Get active tweet ID from pending downloads
      const activeTweetId = Object.keys(pendingDownloads)[0];
      if (activeTweetId) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'videoFound',
            videoUrl: url,
            tweetId: activeTweetId
          });
        });
      }
    }
  },
  { urls: ["<all_urls>"] }
);
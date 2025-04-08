// content.js
let downloadingTweetId = null;
let downloadConfirmed = false;

// Function to add download buttons to tweets with videos
function addDownloadButtons() {
  // Select all tweet containers
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  
  tweets.forEach(tweet => {
    // Check if video exists and no button has been added yet
    const video = tweet.querySelector('video');
    const hasButton = tweet.querySelector('.twitter-video-download-btn');
    
    if (video && !hasButton) {
      // Extract tweet ID
      const tweetId = extractTweetId(tweet);
      if (!tweetId) return;
      
      // Create download button
      const button = document.createElement('button');
      button.textContent = 'Download Video';
      button.className = 'twitter-video-download-btn';
      
      // Add click event to trigger download
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Confirm with user before starting
        if (confirm('Download this video?')) {
          downloadConfirmed = true;
          downloadingTweetId = tweetId;
          
          // Send message to background script
          chrome.runtime.sendMessage({
            action: 'downloadVideo',
            tweetId: tweetId
          });
          
          // Show loading indicator
          button.textContent = 'Preparing...';
          button.disabled = true;
        }
      });
      
      // Add button near the share button
      const actionsBar = tweet.querySelector('div[role="group"]');
      if (actionsBar) {
        const container = document.createElement('div');
        container.className = 'download-btn-container';
        container.appendChild(button);
        actionsBar.appendChild(container);
      }
    }
  });
}

// Extract tweet ID from tweet element
function extractTweetId(tweetElement) {
  // Try to get tweet ID from time element's parent link
  const timeLink = tweetElement.querySelector('time')?.closest('a');
  if (timeLink && timeLink.href) {
    const match = timeLink.href.match(/\/status\/(\d+)/);
    if (match && match[1]) return match[1];
  }
  
  // Try to get from article's aria-labelledby attribute
  const labelId = tweetElement.getAttribute('aria-labelledby');
  if (labelId && labelId.includes('_')) {
    const parts = labelId.split('_');
    // Often the format is something like "tweet_1234567890"
    if (parts.length > 1) return parts[parts.length - 1];
  }
  
  return null;
}

// Message handler for communication with background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'waitingForVideo') {
    console.log('Waiting for video for tweet:', message.tweetId);
    // Find and play the video to trigger the network request
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    tweets.forEach(tweet => {
      const tweetId = extractTweetId(tweet);
      if (tweetId === message.tweetId) {
        const video = tweet.querySelector('video');
        if (video) {
          // Make sure video is playing to trigger the requests
          video.play().catch(err => console.log('Could not play video:', err));
        }
      }
    });
  }
  else if (message.action === 'videoFound') {
    console.log('Video URL found:', message.videoUrl);
    chrome.runtime.sendMessage({
      action: 'videoFound',
      videoUrl: message.videoUrl,
      tweetId: message.tweetId
    });
  }
  else if (message.action === 'startDownload') {
    // Show download dialog
    const downloadUrl = message.url;
    const tweetId = message.tweetId;
    
    // Reset download button state
    resetDownloadButton(tweetId);
    
    // Start the download if user confirmed earlier
    if (downloadConfirmed) {
      chrome.runtime.sendMessage({
        action: 'startDownload',
        url: downloadUrl,
        filename: `twitter_video_${tweetId}.mp4`
      });
      
      // Reset confirmation
      downloadConfirmed = false;
    }
  }
  else if (message.action === 'notifyUser') {
    alert(message.message);
    resetDownloadButton(downloadingTweetId);
  }
});

// Reset download button state
function resetDownloadButton(tweetId) {
  if (!tweetId) return;
  
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  tweets.forEach(tweet => {
    if (extractTweetId(tweet) === tweetId) {
      const button = tweet.querySelector('.twitter-video-download-btn');
      if (button) {
        button.textContent = 'Download Video';
        button.disabled = false;
      }
    }
  });
}

// Initial run
addDownloadButtons();

// Use MutationObserver to detect dynamically loaded tweets
const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      addDownloadButtons();
    }
  }
});

// Start observing
observer.observe(document.body, { childList: true, subtree: true });
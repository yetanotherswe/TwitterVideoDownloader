// Function to add download button below tweets with videos
function addDownloadButtons() {
    // Select all tweet containers (adjust selector based on Twitter's current DOM)
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
   
    tweets.forEach(tweet => {
    // Check if a video exists in this tweet and no button has been added yet
    const video = tweet.querySelector('video');
    const hasButton = tweet.querySelector('.download-btn');
   
    if (video && !hasButton) {
    // Create download button
    const button = document.createElement('button');
    button.textContent = 'Download';
    button.className = 'download-btn';
    button.style.marginTop = '8px';
   
    // Add click event to trigger download
    button.addEventListener('click', () => {
    // Send message to background script to handle download
    chrome.runtime.sendMessage({
    action: 'downloadVideo',
    tweetId: tweet.querySelector('time')?.parentElement?.href?.split('/').pop() || 'unknown'
    });
    });
   
    // Append button below the tweet
    const actionsBar = tweet.querySelector('div[role="group"]');
    if (actionsBar) {
    actionsBar.appendChild(button);
    }
    }
    });
   }
   
   // Initial run
   addDownloadButtons();
   
   // Use MutationObserver to detect dynamically loaded tweets (e.g., scrolling in threads)
   const observer = new MutationObserver(() => {
    addDownloadButtons();
   });
   observer.observe(document.body, { childList: true, subtree: true });
   
   // Listen for video URL from background script
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'videoUrlFound') {
    const { url, tweetId } = message;
    chrome.runtime.sendMessage({
    action: 'startDownload',
    url: url,
    filename: `twitter_video_${tweetId}.mp4`
    });
    }
   });
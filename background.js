// Background script for handling keyboard shortcuts

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-sidebar') {
    // Send message to the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('claude.ai')) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggle-sidebar' 
        }).catch((error) => {
          console.log('Could not send message to content script:', error);
        });
      }
    });
  }
});
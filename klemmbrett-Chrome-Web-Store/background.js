chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.checkboxChecked !== undefined) {
      // Send the message to the content script
      let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });

  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.checkboxChecked !== undefined) {
      // Send the message to the content script
      let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tabs[0].id, { action: "checkCheckbox", value: message.checkboxChecked });
    }
  });

  chrome.commands.onCommand.addListener(function(command) {
    if (command === '_execute_enlarge_action') {
      // Send a message to the active tab to run the enlargeClick function
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'enlargeClick'});
      });
    }
  });
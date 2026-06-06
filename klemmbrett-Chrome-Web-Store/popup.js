let kbEnableCheck = document.querySelector("input[name=enablekb]");
let outterBody = document.getElementById("kb-hottest-body-alive")




window.onload = function() {
  var checkbox = document.getElementById('checkEnable');
  var kbApp = document.getElementById("kb-app-wrapped-in");

  // Restore the checkbox state from storage
  chrome.storage.local.get('checkboxChecked', function(data) {
      if (checkbox) {
          checkbox.checked = data.checkboxChecked;
      }
  });

  if (checkbox && kbApp) {
      // Initialize the checkbox state
      checkbox.checked = getComputedStyle(kbApp).display !== "none";

      // Create a MutationObserver to watch for changes in the kbApp's style
      var observer = new MutationObserver(function() {
          checkbox.checked = getComputedStyle(kbApp).display !== "none";
      });

      // Start observing the kbApp for configuration changes
      observer.observe(kbApp, { attributes: true, attributeFilter: ['style'] });
  }

  if (checkbox) {
      checkbox.addEventListener('change', function() {
          // Save the checkbox state to storage
          chrome.storage.local.set({ checkboxChecked: this.checked });

          // Send a message to the service worker
          chrome.runtime.sendMessage({ checkboxChecked: this.checked });

          // Update the display of kb-app-wrapped-in based on the checkbox state
          if (kbApp) {
              kbApp.style.display = this.checked ? "block" : "none";
          }
      });
  }
};

  
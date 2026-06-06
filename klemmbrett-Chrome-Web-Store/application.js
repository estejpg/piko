var quill;

function injectEditor() {  


    let containerMain = document.createElement("div");
    console.log("da")
    containerMain.innerHTML = `

    <head>
    <script src="quill.js"></script>
    <script src="popup.js"></script>
    <link href="styles.css" rel="stylesheet">

    <style>
    </head>

    /* Quill Styles */


.ql-bubble .ql-toolbar .ql-formats {
    margin: 6px;
}

.ql-bubble .ql-toolbar .ql-formats:first-child {
    margin-left: 6px;
}

.ql-bubble .ql-toolbar button.ql-active {
    background-color: var(--kb-bg-col-darker) !important;
}

.ql-editor {
    padding: 0;
}

.ql-bubble .ql-tooltip {
    background-color: var(--kb-levitate-wrapper);
    border-radius: 12px;
    box-shadow: var(--smooth-shadow);
}

.ql-bubble.ql-toolbar button, .ql-bubble .ql-toolbar button {
    padding: 4px;
}

ql-formats {
    stroke: var(--kb-text-col-default) !important;
    color: var(--text-col-hover) !important;
}

ql-formats > button.ql-active {
    stroke: var(--kb-text-col-default) !important;
    color: var(--text-col-hover) !important;
}

ql-formats:hover {
    stroke: var(--kb-text-col-default) !important;
    color: var(--text-col-hover) !important;
}

.ql-bubble .ql-toolbar button.ql-active .ql-stroke { 
    stroke: var(--kb-text-col-default) !important;
}

.ql-bubble .ql-toolbar button.ql-hover .ql-stroke { 
    stroke: var(--kb-text-col-default) !important;
}

.ql-bubble .ql-stroke {
    stroke: var(--kb-text-col-default) !important;
}

.ql-bubble .ql-picker { 
    color: var(--kb-text-col-default) !important;
}

.ql-bubble .ql-fill {
    fill: var(--kb-text-col-default) !important;
}


span.ql-picker-label {
    color: var(--kb-text-col-default) !important;
}

span.ql-formats {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.ql-editor ol, .ql-editor ul {
    font-size: 16px;
    padding-left: 16px;
    padding-top: 4px;
    padding-bottom: 4px;
    max-width: 100%;

}

.ql-bubble .ql-picker.ql-expanded .ql-picker-options {
    color: var(--kb-text-col-default) !important;
    background-color: var(--kb-levitate-wrapper) !important;
    border-radius: 10px;
    box-shadow: var(--smooth-shadow);
    padding: 12px ;
}

span.ql-picker-item { 
    color: var(--kb-text-col-default) !important;
}

.ql-editor ol li:not(.ql-direction-rtl), .ql-editor ul li:not(.ql-direction-rtl) {
    padding-left: 6px;
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    
}

div.ql-tooltip-editor input {
    padding: 8px 12px !important;
    color: var(--kb-text-col-default) !important;
}

.ql-bubble .ql-picker-options .ql-picker-item {
    padding: 8px 0px;
}

.ql-editor p {
    line-height: 140%;
    font-size: 16px;
    font-weight: 400;
    font-family: inter, sans-serif !important;
    max-width: 100%;
}

.ql-bubble .ql-editor h1 {
    font-size: 26px;
    line-height: 140%;
    font-weight: 500;
    font-family: inter, sans-serif !important;
´}

.ql-bubble .ql-editor h2 {
    font-size: 22px;
    font-weight: 500;
    line-height: 140%;
    font-family: inter, sans-serif !important;
}

.ql-editor ul > li::before {
    caret-color: auto;
    content: " ";
    display: block;
    width: 20px;
    height: 22px;
    margin-bottom: 1px;
    background-color: transparent; /* Ensures the background of the pseudo-element is transparent */
    background-image: radial-gradient(circle 2.5px, var(--kb-text-col-default) 99%, transparent 100%);
    background-position: center;
    background-repeat: no-repeat;
    font-family: inter, sans-serif !important;
    flex-shrink: 0;
}

.ql-editor ol li::before {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
}

.ql-bubble .ql-toolbar button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    margin: 0 2px;
    transition: 0.16s;
}

.ql-bubble .ql-toolbar button:hover {   
    background-color: var(--kb-bg-col-darker) !important;
}

.ql-bubble .ql-editor a {
    color: var(--kb-text-link-col) !important;
    text-decoration: underline;
}

div.ql-editor:focus  {
    outline: none !important;
}        

a::before, a::after {
    display: none;
}

#kb-app-edit-container > div.ql-tooltip > span {   
    display: none;
} 

.ql-editor.ql-blank::before {
    max-width: 564px;
    color: var(--kb-text-col-less);
    margin: auto;
    font-size: 16px;
    font-style: normal;
    opacity: 0.5;
    left: 0;
}



</style>
   
    <div id="kb-hottest-body-alive">
    <div class="kb-app-extended-background" id="kb-app-extended-bg-el">
    </div>
    <div class="kb-app-wrapper-main">
        <div id="kb-app-wrapped-in" class="kb-app-wrapper-inner">
        <div id="kb-app-checked-el" class="kb-app-checker"> <span class="kb-app-smaller-text prev-text-new">klemmbrett </span> </div>
                <div id="kb-app-vis-wrapper" class="kb-app-visibility-wrapper">  
                    <div class="kb-app-first-row">
                    <a class="kb-logo-link-wrapper" href="https://www.klemmbrett.it">
                    <div class="kb-logo-top-left" id="kb-logo-top-color"> </div>
                    <div class="kb-app-title">lemmbrett</div>
                </a>
                        <div class="kb-app-button-wrapper">
                            <a href="mailto:hi@lucaspilzen.com?subject=Idea / Feedback for klemmbrett app">
                            <div class="kb-app-button kb-app-icon-button" id="kb-app-contact">
                            </div>
                            </a>    
                            <button class="kb-app-button kb-app-icon-button" id="kb-app-theme-toggle">
                            </button>
                            <a class="" href="https://www.klemmbrett.it/#sign-up" target=”_blank”>
                            <div class="kb-app-button kb-app-icon-button" id="kb-app-save-btn">
                            </div>
                            </a>
                            <button class="kb-app-button kb-app-icon-button" id="kb-app-extend-btn">
                            </button>
                            <div class="kb-app-divider-verti">
                            </div>
                            <button class="kb-app-button kb-app-icon-button kb-close-btn-function" id="kb-app-close-btn-top">
                            </button>
                            
                        </div>
                    </div>
                    <div class="kb-app-divider-hori"></div> 
                    <div class="kb-app-second-row">
                       <div id="kb-app-edit-container" ></div>
                    
                    </div>
                    <div class="kb-app-divider-hori"></div> 
                                        <div class="kb-app-third-row">
                    <button class="kb-app-button kb-app-close-button kb-close-btn-function" id="kb-app-close-btn">save & keep exploring</button>
                    
    
                    </div>
                </div>
        </div>
    </div>
    </div>
    `;

    // <textarea placeholder='still day one' class="kb-app-edit-wrapper" id="kb-app-edit-container" ></textarea> -->

    document.body.appendChild(containerMain)



 
    quill = new Quill('#kb-app-edit-container', {
        theme: 'bubble',
        modules: {
            toolbar: [ { 'header': 1 }, { 'header': 2 }, 'bold', 'italic', 'underline', { 'list': 'ordered'}, { 'list': 'bullet' }, 'link', 'image', 'clean' ],
            keyboard: {
                bindings: {
                    list: {
                        key: '.',
                        format: { list: true },
                        handler: function(range, context) {
                            if (context.prefix.match(/^\d+$/)) {
                                // If the prefix is a number, insert a period instead of creating a list
                                this.quill.insertText(range.index, '.', 'user');
                                return false;
                            } else {
                                // Otherwise, create a list as usual
                                this.quill.format('list', 'ordered', 'user');
                            }
                        }
                    }
                }
            }
        },
        bounds: document.getElementById("kb-app-edit-container"),
        placeholder: 'let your thoughts flow',
    });

    var quillLinkInputElement = document.querySelector('.ql-bubble .ql-tooltip-editor input[type="text"]');
    quillLinkInputElement.value = 'https://www.klemmbrett.it/';

    

    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (message.checkboxChecked !== undefined) {
          var kbElementMain = document.getElementById("kb-app-wrapped-in");
      
          if (kbElementMain) {
            kbElementMain.style.display = message.checkboxChecked ? "block" : "none";
          }
      
          // Send a response indicating whether the "kb-app-wrapped-in" element is displayed or not
          sendResponse({ checkboxChecked: kbElementMain && kbElementMain.style.display === "block" });
        }
      });
      

      chrome.storage.local.get('checkboxChecked', function(data) {
        var kbElementMain = document.getElementById("kb-app-wrapped-in");
    
        if (kbElementMain) {
            // If the checkbox state is not in storage, set it to true
            let checkboxChecked = data.checkboxChecked !== undefined ? data.checkboxChecked : true;
            kbElementMain.style.display = checkboxChecked ? "block" : "none";
    
            // Assuming 'yourCheckboxId' is the ID of your checkbox
            document.getElementById('yourCheckboxId').checked = kbElementMain.style.display === "block";
        }
    });
    

    // ICONS
    document.getElementById('kb-app-close-btn-top').style.backgroundImage = `url(${chrome.runtime.getURL('images/dismiss.svg')})`;
    document.getElementById('kb-app-save-btn').style.backgroundImage = `url(${chrome.runtime.getURL('images/avatar.svg')})`;
    document.getElementById('kb-app-extend-btn').style.backgroundImage = `url(${chrome.runtime.getURL('images/extend-maxi.svg')})`;
    document.getElementById('kb-app-theme-toggle').style.backgroundImage = `url(${chrome.runtime.getURL('images/dark-mode.svg')})`;
    document.getElementById('kb-app-contact').style.backgroundImage = `url(${chrome.runtime.getURL('images/contact.svg')})`;
    
    
    darkMode()
    detectColorScheme();
    extendNotesInterface()
    loadSavedNotes()
    enlargeClick()
    openQuillLinksInNewTab()

    const options = {};
    kbAppEditContainer = document.getElementById("kb-app-edit-container");

    kbAppEditContainer.addEventListener("")

}

function openQuillLinksInNewTab() {

    let Link = Quill.import('formats/link');

    class CustomLink extends Link {
      static create(value) {
        // Check if the URL starts with http:// or https://
        if (!/^https?:\/\//i.test(value)) {
          value = 'http://' + value;
        }

        let kbLinkNode = super.create(value);
        kbLinkNode.setAttribute('target', '_blank');
        kbLinkNode.addEventListener('dblclick', function(event) {
          let href = kbLinkNode.getAttribute('href');
          window.open(href, '_blank');
          event.preventDefault();
        });
        return kbLinkNode;
      }
    }
    
    CustomLink.blotName = 'link';
    CustomLink.tagName = 'A';
    
    Quill.register(CustomLink);
}


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'enlargeClick') {
      enlargeClick();
    }
});




function enlargeClick() {
    const checkerEl = document.getElementById("kb-app-checked-el");
    const wrappedIn = document.getElementById("kb-app-wrapped-in");
    const visWrapper = document.getElementById("kb-app-vis-wrapper");
    const extendInterfaceBackground = document.getElementById("kb-app-extended-bg-el");
    const kbAppEditContainer = document.getElementById("kb-app-edit-container");
    const closeButtons = document.getElementsByClassName("kb-close-btn-function");
    const quillEdit = document.getElementsByClassName("ql-editor");

    function disableKeystrokes(event) {
        event.preventDefault();
      }

      checkerEl.addEventListener("focusout", function () {
        document.addEventListener("keydown", disableKeystrokes);
      });

      for (const button of closeButtons) {
        button.addEventListener("focusout", function () {
            document.removeEventListener("keydown", disableKeystrokes);
        });
      }

    

    checkerEl.addEventListener("click", function () {
        checkerEl.style.display = 'none';
        wrappedIn.classList.remove('small');
        wrappedIn.classList.add('normal');
        visWrapper.classList.add('visible');
        focusTextarea();
    });

    function focusTextarea() {
        setTimeout(function() {
            quill.focus(); 
        }, 420);
    }
    for (const button of closeButtons) {
        button.addEventListener("click", function () {
            wrappedIn.classList.remove('normal', 'extended');
            wrappedIn.classList.add('small');
            checkerEl.style.display = 'flex';
            visWrapper.classList.remove('visible');
            extendInterfaceBackground.classList.remove('visible');
            let notesContent = quill.getContents();
            chrome.storage.local.set({ 'notesContent': notesContent }, function() {
            });
        });
    }
      
}




function extendNotesInterface() {
    const appExtendBtn = document.getElementById("kb-app-extend-btn");
    const extendInterfaceBackground = document.getElementById("kb-app-extended-bg-el");
    const wrappedIn = document.getElementById("kb-app-wrapped-in");
    const visWrapper = document.getElementById("kb-app-vis-wrapper");

    appExtendBtn.addEventListener("click", function () {
        if (extendInterfaceBackground.classList.contains('visible')) {
            extendInterfaceBackground.classList.remove('visible');
            wrappedIn.classList.remove('extended');
            wrappedIn.classList.add('normal');
            visWrapper.style.boxShadow = "none";
        } else {
            extendInterfaceBackground.classList.add('visible');
            wrappedIn.classList.add('extended');
            wrappedIn.classList.remove('normal');
            visWrapper.style.boxShadow = "0 8px 24px 0 rgba(0,0,0,.2),0 2px 8px 0 rgba(0,0,0,.08),inset 0 0 0 1px hsla(0,0%,100%,.04),0 0 0 1px rgba(0,0,0,.02);";
        }
    });

    
}



function loadSavedNotes() {
    chrome.storage.local.get('notesContent', function(result) {
        if (result.notesContent !== undefined) {
            quill.setContents(result.notesContent);
        }
    });
}

function darkMode() {
    var toggle = document.getElementById("kb-app-theme-toggle");

    chrome.storage.local.get('theme', function(data) {
        var storedTheme = data.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.setAttribute('data-theme', storedTheme);

        toggle.onclick = function() {
            var currentTheme = document.documentElement.getAttribute("data-theme");
            var targetTheme = (currentTheme === "light") ? "dark" : "light";
            
            document.documentElement.setAttribute('data-theme', targetTheme);
            chrome.storage.local.set({'theme': targetTheme});
        };
    });
}



function detectColorScheme() {
    return new Promise(function(resolve) {
        chrome.storage.local.get("theme", function(data) {
            var theme = data.theme;

            if(!theme) {
                // If no theme is set in storage, check OS theme setting
                theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            }

            document.documentElement.setAttribute("data-theme", theme);
            resolve(theme);
        });
    });
}

// Listen for changes to the storage
chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (var key in changes) {
      var storageChange = changes[key];
      if (key === 'theme') {
        // If the theme in storage has changed, update the theme in this tab
        document.documentElement.setAttribute("data-theme", storageChange.newValue);
      }
    }
  });
  
  function darkMode() {
    var toggle = document.getElementById("kb-app-theme-toggle");
  
    chrome.storage.local.get('theme', function(data) {
      var storedTheme = data.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.setAttribute('data-theme', storedTheme);
  
      toggle.onclick = function() {
        var currentTheme = document.documentElement.getAttribute("data-theme");
        var targetTheme = (currentTheme === "light") ? "dark" : "light";
        
        document.documentElement.setAttribute('data-theme', targetTheme);
        chrome.storage.local.set({'theme': targetTheme});
      };
    });
  }
  
  // Rest of your code...




// Function to save notesContent and color scheme
function saveNotesContent() {
    let notesContent = quill.getContents();
    chrome.storage.local.set({ 'notesContent': notesContent }, function() {});

    // Save color scheme
    var currentTheme = document.documentElement.getAttribute("data-theme");
    chrome.storage.local.set({ 'theme': currentTheme });
}

// Function to load notesContent
function loadNotesContent() {
    chrome.storage.local.get('notesContent', function(result) {
        if (result.notesContent !== undefined) {
            let currentContent = quill.getContents();
            // Check if the new content is different from the current content
            if (JSON.stringify(result.notesContent) !== JSON.stringify(currentContent)) {
                quill.setContents(result.notesContent, 'api'); // Add 'api' as the second parameter
            }
        }
    });
}

// Function to load color scheme
function loadColorScheme() {
    chrome.storage.local.get('theme', function(data) {
        var storedTheme = data.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.setAttribute('data-theme', storedTheme);
    });
}
  
  // Save notesContent every 5 seconds
  setInterval(function() {
    saveNotesContent();
  }, 2000);
  
  // Listen for changes in the storage area
  chrome.storage.onChanged.addListener(function(changes, areaName) {
    // Check if notesContent has changed
    if (changes.notesContent && areaName === 'local') {
      // Load the new notesContent
      loadNotesContent();
    }
  });
function detectColorScheme() {
    return new Promise(function(resolve) {
        chrome.storage.local.get("theme", function(data) {
            var theme = data.theme;

            if(!theme) {
                // If no theme is set in storage, check OS theme setting
                theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            }

            document.documentElement.setAttribute("data-theme", theme);
            resolve(theme);
        });
    });
}

// Listen for changes to the storage
chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (var key in changes) {
      var storageChange = changes[key];
      if (key === 'theme') {
        // If the theme in storage has changed, update the theme in this tab
        document.documentElement.setAttribute("data-theme", storageChange.newValue);
      }
    }
  });
  
  function darkMode() {
    var toggle = document.getElementById("kb-app-theme-toggle");

    chrome.storage.local.get('theme', function(data) {
        var storedTheme = data.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.setAttribute('data-theme', storedTheme);

        // Set the logo based on the current theme
        document.getElementById('kb-logo-top-color').style.backgroundImage =
            `url(${chrome.runtime.getURL('images/kb-logo-' + (storedTheme === 'dark' ? 'dark' : 'light') + '-mode.svg')})`;

        toggle.onclick = function() {
            var currentTheme = document.documentElement.getAttribute("data-theme");
            var targetTheme = (currentTheme === "light") ? "dark" : "light";

            document.documentElement.setAttribute('data-theme', targetTheme);
            chrome.storage.local.set({'theme': targetTheme});

            // Set the logo based on the new theme
            document.getElementById('kb-logo-top-color').style.backgroundImage =
                `url(${chrome.runtime.getURL('images/kb-logo-' + (targetTheme === 'dark' ? 'dark' : 'light') + '-mode.svg')})`;
        };
    });
}



// Function to save notesContent and color scheme
function saveNotesContent() {
    let notesContent = quill.getContents();
    chrome.storage.local.set({ 'notesContent': notesContent }, function() {});

    // Save color scheme
    var currentTheme = document.documentElement.getAttribute("data-theme");
    chrome.storage.local.set({ 'theme': currentTheme });
}

// Function to load notesContent
function loadNotesContent() {
    chrome.storage.local.get('notesContent', function(result) {
        if (result.notesContent !== undefined) {
            let currentContent = quill.getContents();
            // Check if the new content is different from the current content
            if (JSON.stringify(result.notesContent) !== JSON.stringify(currentContent)) {
                // Save the current cursor position
                let cursorPosition = quill.getSelection();

                quill.setContents(result.notesContent, 'api'); // Add 'api' as the second parameter

                // After updating the content, restore the cursor position
                if (cursorPosition) quill.setSelection(cursorPosition);
            }
        }
    });
}

// Function to load color scheme
function loadColorScheme() {
    chrome.storage.local.get('theme', function(data) {
        var storedTheme = data.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.setAttribute('data-theme', storedTheme);
    });
}
  
  // Save notesContent every 5 seconds
  setInterval(function() {
    saveNotesContent();
  }, 2000);
  
  // Listen for changes in the storage area
  chrome.storage.onChanged.addListener(function(changes, areaName) {
    // Check if notesContent has changed
    if (changes.notesContent && areaName === 'local') {
      // Load the new notesContent
      loadNotesContent();
    }
  });





  
  // Load notesContent when the tab is activated
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      loadNotesContent();
    }
  });
  
  if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', injectEditor);
  } else {
    injectEditor();
  }

  // Load notesContent when the tab is activated
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadNotesContent();
    }
});

if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', injectEditor);
} else {
    injectEditor();
}





if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', injectEditor);
} else {
    injectEditor();
}



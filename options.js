// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  hoverDelay: 200,
  collapseDelay: 500,
  debug: false
};

// DOM elements
const elements = {
  enabled: document.getElementById('enabled'),
  hoverDelay: document.getElementById('hoverDelay'),
  collapseDelay: document.getElementById('collapseDelay'),
  debug: document.getElementById('debug'),
  saveButton: document.getElementById('save'),
  resetButton: document.getElementById('reset'),
  reloadLink: document.getElementById('reload-extension'),
  status: document.getElementById('status')
};

// Load settings
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    elements.enabled.checked = items.enabled;
    elements.hoverDelay.value = items.hoverDelay;
    elements.collapseDelay.value = items.collapseDelay;
    elements.debug.checked = items.debug;
  });
}

// Save settings
function saveSettings() {
  const settings = {
    enabled: elements.enabled.checked,
    hoverDelay: parseInt(elements.hoverDelay.value, 10),
    collapseDelay: parseInt(elements.collapseDelay.value, 10),
    debug: elements.debug.checked
  };
  
  // Validation
  if (settings.hoverDelay < 0 || settings.hoverDelay > 2000) {
    showStatus('Hover delay must be between 0-2000 milliseconds', 'error');
    return;
  }
  
  if (settings.collapseDelay < 0 || settings.collapseDelay > 3000) {
    showStatus('Collapse delay must be between 0-3000 milliseconds', 'error');
    return;
  }
  
  chrome.storage.sync.set(settings, () => {
    showStatus('Settings saved', 'success');
    
    // Send message to active tab (optional)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('claude.ai')) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'settingsUpdated', 
          settings: settings 
        }).catch(() => {
          // Ignore error (if tab doesn't support extension)
        });
      }
    });
  });
}

// Reset settings
function resetSettings() {
  if (confirm('Reset settings to default values?')) {
    chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
      loadSettings();
      showStatus('Settings reset to default values', 'success');
    });
  }
}

// Show status message
function showStatus(message, type = 'success') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.style.display = 'block';
  
  setTimeout(() => {
    elements.status.style.display = 'none';
  }, 3000);
}

// Reload extension
function reloadExtension(e) {
  e.preventDefault();
  chrome.runtime.reload();
}

// Auto-adjust input values
function adjustInputValue(input, min, max, step) {
  input.addEventListener('input', (e) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value)) return;
    
    // Min/max value constraints
    if (value < min) value = min;
    if (value > max) value = max;
    
    // Round to step value
    value = Math.round(value / step) * step;
    
    e.target.value = value;
  });
}

// Real-time validation
function setupValidation() {
  adjustInputValue(elements.hoverDelay, 0, 2000, 50);
  adjustInputValue(elements.collapseDelay, 0, 3000, 50);
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveSettings();
    }
    
    // Ctrl/Cmd + R to reset
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      resetSettings();
    }
  });
}

// Auto-save on settings change (optional)
function setupAutoSave() {
  let saveTimer;
  const autoSaveDelay = 1000; // Auto-save after 1 second
  
  const debounceSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveSettings();
    }, autoSaveDelay);
  };
  
  // Save checkboxes immediately
  elements.enabled.addEventListener('change', saveSettings);
  elements.debug.addEventListener('change', saveSettings);
  
  // Delayed save for numeric inputs
  elements.hoverDelay.addEventListener('input', debounceSave);
  elements.collapseDelay.addEventListener('input', debounceSave);
}

// Show tooltips (optional)
function setupTooltips() {
  const tooltips = {
    hoverDelay: 'Recommended: 200-500 milliseconds',
    collapseDelay: 'Recommended: 300-1000 milliseconds'
  };
  
  Object.entries(tooltips).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) {
      element.title = text;
    }
  });
}

// Animation effects
function addAnimations() {
  // Save button animation
  elements.saveButton.addEventListener('click', function() {
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.style.transform = 'scale(1)';
    }, 100);
  });
}

// Open shortcuts page
function openShortcutsPage(e) {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupValidation();
  setupKeyboardShortcuts();
  setupTooltips();
  addAnimations();
  
  // Setup event listeners
  elements.saveButton.addEventListener('click', saveSettings);
  elements.resetButton.addEventListener('click', resetSettings);
  elements.reloadLink.addEventListener('click', reloadExtension);
  
  // Add shortcuts link listener
  const shortcutsLink = document.getElementById('shortcuts-link');
  if (shortcutsLink) {
    shortcutsLink.addEventListener('click', openShortcutsPage);
  }
  
  // Uncomment to enable auto-save
  // setupAutoSave();
});

// Check if Chrome extension API is available
if (!chrome?.storage?.sync) {
  showStatus('Chrome extension API is not available', 'error');
  document.querySelectorAll('button, input').forEach(el => {
    el.disabled = true;
  });
}
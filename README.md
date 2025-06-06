# Claude Sidebar Controller

A Chrome extension that controls the Claude.ai sidebar with auto-hover and keyboard shortcuts.

> **Disclaimer:** This is an unofficial extension and is not affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.

## Features

- Auto-expand sidebar when hovering over left edge
- Auto-collapse when moving away from sidebar
- Smart positioning to avoid navigation buttons
- Configurable hover delays
- Keyboard shortcut support for manual toggle
- Individual on/off controls for hover and keyboard features

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. Visit Claude.ai and enjoy auto-hover functionality

## Usage

### Auto-hover functionality
Hover over the left edge of Claude.ai (below the navigation buttons) to expand the sidebar. Move away from both the trigger area and sidebar to collapse it.

### Keyboard shortcuts
You can also toggle the sidebar manually using a keyboard shortcut:
1. Go to `chrome://extensions/shortcuts`
2. Find "Claude Sidebar Controller" 
3. Set your preferred key combination for "Toggle Claude sidebar"

## Configuration

Click the extension icon to adjust:

### Feature Settings
- **Enable hover expand**: Turn hover functionality on/off
- **Enable keyboard shortcuts**: Turn keyboard shortcut functionality on/off

### Timing Settings (when hover is enabled)
- **Hover delay timing**: Wait time before sidebar expands
- **Collapse delay timing**: Wait time before sidebar collapses

### Other Settings
- **Keyboard shortcut setup**: Link to Chrome shortcuts page
- **Debug mode**: Shows trigger areas and detailed console logs

### Usage Scenarios
- **Hover only**: Enable hover, disable shortcuts
- **Shortcuts only**: Disable hover, enable shortcuts  
- **Both features**: Enable both for maximum convenience
- **Disabled**: Turn off both to temporarily disable the extension

## License

MIT License
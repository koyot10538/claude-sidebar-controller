(function() {
  'use strict';

  // Default configuration values
  const DEFAULT_CONFIG = {
    enabled: true,
    hoverDelay: 200,
    collapseDelay: 500,
    debug: false  // Debug mode disabled by default
  };

  let config = { ...DEFAULT_CONFIG };
  let hoverTimer = null;
  let collapseTimer = null;
  let sidebarButton = null;
  let sidebar = null;
  let triggerElement = null;
  let currentMouseX = 0;
  let currentMouseY = 0;
  let isInTriggerZone = false;
  let isInSidebar = false;
  let sidebarHoverListeners = null;
  
  // Trigger area width (fixed)
  const TRIGGER_WIDTH = 50;
  
  // Debug logging
  function log(...args) {
    if (config.debug) {
      console.log('[Claude Sidebar]', ...args);
    }
  }

  // Load configuration
  chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
    config = { ...config, ...items };
    log('Configuration loaded:', config);
    if (config.enabled) {
      initialize();
    }
  });

  // Initialize extension (improved version)
  function initialize() {
    log('Initializing extension...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      // Wait a bit after page load before setup
      // React apps may add elements dynamically even after DOMContentLoaded
      setTimeout(setup, 500);
    }
    
    // Additional fallback: retry initialization after some time
    setTimeout(() => {
      if (!sidebar || !sidebarButton) {
        log('🔄 Elements not found after initialization, retrying...');
        setup();
      }
    }, 3000);
  }

  // Setup function
  function setup() {
    findSidebarElements();
    setupMouseTracking();
    setupDOMObserver();
    
    // Add hover listeners if sidebar is already expanded
    setTimeout(() => {
      if (isSidebarExpanded()) {
        log('🔍 Sidebar already expanded during initialization, adding hover listeners');
        addSidebarHoverListeners();
      }
    }, 1000); // Wait for element detection to complete
  }

  // Find sidebar elements (try multiple selectors)
  function findSidebarElements() {
    // Try multiple possible sidebar selectors
    const sidebarSelectors = [
      'nav[data-testid="menu-sidebar"]',
      'aside[role="navigation"]',
      'nav[role="navigation"]',
      'div[data-testid*="sidebar"]',
      'div[role="navigation"]',
      'nav',
      'aside',
      'div[class*="sidebar"]',
      'div[class*="navigation"]',
      'div[class*="nav"]',
      'div[style*="left"]',
      // React-based app selectors
      'div[data-reactid]',
      'div[class*="fixed"][class*="left"]',
      'div[class*="absolute"][class*="left"]'
    ];
    
    // Precise trigger element selector (identified from screenshots)
    const triggerSelector = 'div.h-full.w-full.cursor-pointer.absolute.top-0.z-sidebar';
    
    // First, find the trigger element
    triggerElement = findTriggerElement(triggerSelector);
    
    log('🔍 Searching for sidebar... Available selector count:', sidebarSelectors.length);
    
    for (let i = 0; i < sidebarSelectors.length; i++) {
      const selector = sidebarSelectors[i];
      const elements = document.querySelectorAll(selector);
      
      log(`Attempt ${i + 1}/${sidebarSelectors.length}: ${selector} → Found ${elements.length} elements`);
      
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        // Check if element looks like a sidebar
        if (isLikelysidebar(element, rect, style)) {
          sidebar = element;
          log('🎯 Sidebar found:', {
            selector: selector,
            element: element,
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            rect: rect,
            textContent: element.textContent.substring(0, 100) + '...'
          });
          
          // Find sidebar button
          sidebarButton = findSidebarToggleButton();
          
          // Use trigger element as sidebar button as well
          if (!sidebarButton && triggerElement) {
            sidebarButton = triggerElement;
            log('🎯 Using trigger element as sidebar button:', sidebarButton);
          }
          
          if (sidebarButton) {
            log('🎯 Sidebar button found:', sidebarButton);
            return; // Exit on success
          } else {
            log('❌ No button found for this sidebar, trying next candidate...');
          }
        }
      }
    }
    
    // Find sidebar button (identified from screenshots)
    if (!sidebarButton) {
      // First, try original z-sidebar element (even if hidden)
      const originalTrigger = document.querySelector('div.h-full.w-full.cursor-pointer.absolute.top-0.z-sidebar');
      if (originalTrigger) {
        sidebarButton = originalTrigger;
        log('🎯 Using original z-sidebar element as button:', originalTrigger);
      } else {
        // Fallback: click navigation element
        const navElement = document.querySelector('nav.fixed.top-0.left-0, nav[class*="fixed"][class*="left"]');
        if (navElement) {
          sidebarButton = navElement;
          log('🎯 Using navigation element as button:', navElement);
        }
      }
    }
    
    // If trigger element is found, use it as button (fallback)
    if (!sidebar && triggerElement && !sidebarButton) {
      log('🎯 Fallback: Using trigger element as button');
      sidebarButton = triggerElement;
      // Create dummy sidebar element (for state checking)
      sidebar = triggerElement.parentElement || document.body;
      return;
    }
    
    if (!sidebar) {
      log('❌ Sidebar not found');
      logDOMStructure(); // Output debug information
      // Retry after waiting a bit
      setTimeout(findSidebarElements, 2000);
    }
  }
  
  // Determine if element looks like a sidebar
  function isLikelysidebar(element, rect, style) {
    // Check if element is on the left side of screen
    const isOnLeftSide = rect.left < window.innerWidth * 0.3;
    
    // Check if element has reasonable height
    const hasReasonableHeight = rect.height > window.innerHeight * 0.3;
    
    // Check if element is visible
    const isVisible = rect.width > 0 && rect.height > 0 && 
                     style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     parseFloat(style.opacity || '1') > 0;
    
    // Check if element contains navigation-like content
    const hasNavContent = element.textContent.includes('New') || 
                         element.textContent.includes('Menu') ||
                         element.textContent.includes('Navigation') ||
                         element.querySelectorAll('a, button').length > 2;
    
    const isLikely = isOnLeftSide && hasReasonableHeight && isVisible && hasNavContent;
    
    if (config.debug) {
      log('Sidebar detection:', {
        element: element.tagName + (element.className ? '.' + element.className.split(' ')[0] : ''),
        isOnLeftSide,
        hasReasonableHeight,
        isVisible,
        hasNavContent,
        isLikely,
        rect: {
          left: rect.left,
          width: rect.width,
          height: rect.height
        }
      });
    }
    
    return isLikely;
  }
  
  // Log DOM structure (for debugging)
  function logDOMStructure() {
    if (!config.debug) return;
    
    log('🐛 Debugging DOM structure...');
    
    // Find elements on the left side
    const leftElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.left < 200 && rect.width > 50 && rect.height > 100;
    });
    
    log('Left side elements:', leftElements.map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      rect: el.getBoundingClientRect(),
      textPreview: el.textContent.substring(0, 50)
    })));
    
    // Find navigation-related elements
    const navElements = document.querySelectorAll('nav, aside, [role="navigation"], [class*="nav"], [class*="sidebar"], [class*="menu"]');
    log('Navigation-related elements:', Array.from(navElements).map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      role: el.getAttribute('role'),
      rect: el.getBoundingClientRect()
    })));
  }

  // Find trigger element (improved version)
  function findTriggerElement(selector) {
    log('🎯 Searching for trigger element:', selector);
    
    // First, try the specified selector
    let element = document.querySelector(selector);
    if (element && !element.classList.contains('hidden')) {
      log('🎯 Trigger element found with specified selector:', {
        selector: selector,
        element: element,
        className: element.className
      });
      return element;
    }
    
    // Workaround for hidden class issue: use navigation element itself
    const navElement = document.querySelector('nav.fixed.top-0.left-0, nav[class*="fixed"][class*="left"]');
    if (navElement) {
      log('🎯 Using navigation element as trigger:', {
        element: navElement,
        className: navElement.className,
        reason: 'Workaround for hidden class issue'
      });
      return navElement;
    }
    
    // Fallback: use sidebar container
    const sidebarContainer = document.querySelector('div.fixed.z-sidebar');
    if (sidebarContainer) {
      log('🎯 Using sidebar container as trigger:', {
        element: sidebarContainer,
        className: sidebarContainer.className,
        reason: 'Navigation element fallback'
      });
      return sidebarContainer;
    }
    
    log('❌ Trigger element not found');
    return null;
  }

  // Find sidebar toggle button (Claude.ai specific)
  function findSidebarToggleButton() {
    log('🔍 Searching for sidebar toggle button...');
    
    // Claude.ai sidebar toggle button is at a specific position
    // Look for hamburger menu button in top left
    const buttons = document.querySelectorAll('button');
    
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const ariaLabel = button.getAttribute('aria-label') || '';
      const testId = button.getAttribute('data-testid') || '';
      
      // Button in top left that's sidebar-related (exclude attachment menu button)
      if (rect.left < 100 && rect.top < 100 && 
          rect.width > 20 && rect.height > 20 &&
          !testId.includes('input-menu-plus') &&
          !ariaLabel.includes('attachment')) {
        
        // Prioritize buttons with SVG icons
        const hasSvg = button.querySelector('svg');
        const hasPath = button.querySelector('path');
        
        if (hasSvg || hasPath) {
          log('🎯 Sidebar toggle button found:', {
            button,
            rect,
            ariaLabel,
            testId,
            hasSvg: !!hasSvg
          });
          return button;
        }
      }
    }
    
    // Look for first button inside nav element (likely menu button)
    const nav = document.querySelector('nav.fixed.top-0.left-0, nav[class*="fixed"][class*="left"]');
    if (nav) {
      const navButton = nav.querySelector('button:first-of-type');
      if (navButton) {
        log('🎯 First button found in navigation:', navButton);
        return navButton;
      }
    }
    
    
    log('❌ Sidebar toggle button not found');
    logButtonCandidates(); // Output debug information
    return null;
  }
  
  // Log button candidates (for debugging)
  function logButtonCandidates() {
    if (!config.debug) return;
    
    log('🐛 Debugging button candidates...');
    
    // Clickable elements on the left side
    const leftButtons = Array.from(document.querySelectorAll('button, [role="button"], [onclick], .btn, .clickable')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.left < 300 && rect.width > 10 && rect.height > 10;
    });
    
    log('Left side button candidates:', leftButtons.map(btn => ({
      tagName: btn.tagName,
      className: btn.className,
      id: btn.id,
      ariaLabel: btn.getAttribute('aria-label'),
      textContent: btn.textContent.substring(0, 30),
      rect: btn.getBoundingClientRect(),
      hasSvg: !!btn.querySelector('svg'),
      hasIcon: !!btn.querySelector('[class*="icon"]')
    })));
  }

  // Setup mouse tracking (custom trigger area version)
  function setupMouseTracking() {
    // Create debug area
    createDebugArea();
    
    // Create custom trigger area
    createCustomTriggerArea();
    
    log('✅ Custom trigger area-based hover detection configured');
  }

  // Create custom trigger area
  function createCustomTriggerArea() {
    // Remove existing custom trigger
    const existing = document.querySelector('.claude-custom-trigger');
    if (existing) existing.remove();
    
    // Find navigation element
    const navElement = document.querySelector('nav.fixed.top-0.left-0, nav[class*="fixed"][class*="left"]');
    if (!navElement) {
      log('❌ Navigation element not found, cannot create custom trigger');
      return;
    }
    
    // Create custom trigger area
    const customTrigger = document.createElement('div');
    customTrigger.className = 'claude-custom-trigger';
    if (config.debug) {
      customTrigger.classList.add('debug');
    }
    customTrigger.style.cssText = `
      position: fixed;
      top: 200px;
      left: 0;
      width: 50px;
      height: calc(100vh - 200px);
      z-index: 10000;
      pointer-events: auto;
      background: transparent;
    `;
    
    // Setup event listeners
    customTrigger.addEventListener('mouseenter', handleDirectMouseEnter);
    customTrigger.addEventListener('mouseleave', handleDirectMouseLeave);
    
    document.body.appendChild(customTrigger);
    
    log('🎯 Custom trigger area created:', {
      element: customTrigger,
      position: 'right: 0, width: 50px',
      reason: 'Complete workaround for hidden class issue'
    });
    
    // Set as triggerElement
    triggerElement = customTrigger;
  }

  // Setup direct hover listeners
  function setupDirectHoverListeners() {
    if (!triggerElement) return;
    
    // Remove existing listeners
    triggerElement.removeEventListener('mouseenter', handleDirectMouseEnter);
    triggerElement.removeEventListener('mouseleave', handleDirectMouseLeave);
    
    // Add new listeners
    triggerElement.addEventListener('mouseenter', handleDirectMouseEnter);
    triggerElement.addEventListener('mouseleave', handleDirectMouseLeave);
    
    log('🎯 Direct hover listeners configured:', triggerElement);
  }

  // Direct mouse enter handler
  function handleDirectMouseEnter(e) {
    log('🟢 Mouse entered trigger element');
    isInTriggerZone = true;
    handleEnterTriggerZone();
  }

  // Direct mouse leave handler
  function handleDirectMouseLeave(e) {
    log('🔴 Mouse left trigger element');
    isInTriggerZone = false;
    handleLeaveTriggerZone();
  }

  // Sidebar mouse enter handler
  function handleSidebarMouseEnter(e) {
    log('🟢 Mouse entered sidebar');
    isInSidebar = true;
    
    // Cancel collapse timer
    if (collapseTimer) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
      log('Collapse timer cancelled due to sidebar entry');
    }
  }

  // Sidebar mouse leave handler
  function handleSidebarMouseLeave(e) {
    log('🔴 Mouse left sidebar');
    isInSidebar = false;
    handleLeaveTriggerZone();
  }

  // Add hover listeners to sidebar
  function addSidebarHoverListeners() {
    if (!sidebar || sidebarHoverListeners) return;
    
    // Get fixed position left navigation element
    const navElement = document.querySelector('nav.fixed.top-0.left-0, nav[class*="fixed"][class*="left"]');
    if (!navElement) {
      log('❌ Navigation element not found, cannot add sidebar hover listeners');
      return;
    }
    
    navElement.addEventListener('mouseenter', handleSidebarMouseEnter);
    navElement.addEventListener('mouseleave', handleSidebarMouseLeave);
    
    sidebarHoverListeners = {
      element: navElement,
      mouseenter: handleSidebarMouseEnter,
      mouseleave: handleSidebarMouseLeave
    };
    
    log('✅ Hover listeners added to sidebar:', navElement);
  }

  // Remove hover listeners from sidebar
  function removeSidebarHoverListeners() {
    if (!sidebarHoverListeners) return;
    
    const { element, mouseenter, mouseleave } = sidebarHoverListeners;
    element.removeEventListener('mouseenter', mouseenter);
    element.removeEventListener('mouseleave', mouseleave);
    
    sidebarHoverListeners = null;
    isInSidebar = false;
    
    log('🗑️ Hover listeners removed from sidebar');
  }

  // Create debug area (left edge placement)
  function createDebugArea() {
    const existing = document.querySelector('.claude-hover-trigger');
    if (existing) existing.remove();
    
    const debugArea = document.createElement('div');
    debugArea.className = 'claude-hover-trigger';
    debugArea.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 50px;
      height: 200px;
      z-index: 9999;
      pointer-events: none;
      background: ${config.debug ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};
      border: ${config.debug ? '1px dashed rgba(59, 130, 246, 0.5)' : 'none'};
    `;
    document.body.appendChild(debugArea);
  }

  // Deprecated: Old mouse move handler (element-based detection only)
  function handleMouseMove(e) {
    // This function is not used - using element-based detection
    log('⚠️ Old mouse move handler called (deprecated)');
  }

  // Entered trigger zone
  function handleEnterTriggerZone() {
    log('🟢 Entered trigger zone');
    
    // Add debug information
    log('🔍 Debug info:', {
      hasSidebarButton: !!sidebarButton,
      sidebarExpanded: isSidebarExpanded(),
      triggerElement: !!triggerElement,
      hoverDelay: config.hoverDelay
    });
    
    // Cancel collapse timer
    if (collapseTimer) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
      log('Collapse timer cancelled');
    }
    
    // Start expand timer only if sidebar is closed
    if (!isSidebarExpanded() && sidebarButton) {
      log('📅 Starting expand timer...');
      hoverTimer = setTimeout(() => {
        log('⏰ Expand timer fired');
        if (isInTriggerZone && !isSidebarExpanded()) {
          log('🖱️ Clicking sidebar button:', sidebarButton);
          sidebarButton.click();
          log('✅ Sidebar expanded');
          
          // After sidebar expansion, wait a bit then add hover listeners to sidebar
          setTimeout(() => {
            if (isSidebarExpanded()) {
              addSidebarHoverListeners();
            }
          }, 300); // Wait for animation to complete
        } else {
          log('❌ Expand conditions not met:', {
            isInTriggerZone,
            sidebarExpanded: isSidebarExpanded()
          });
        }
      }, config.hoverDelay);
      
      log(`Expand timer started (${config.hoverDelay}ms)`);
    } else {
      log('❌ Did not start expand timer:', {
        sidebarExpanded: isSidebarExpanded(),
        hasSidebarButton: !!sidebarButton
      });
    }
  }

  // Left trigger zone
  function handleLeaveTriggerZone() {
    log('🔴 Left trigger zone');
    
    // Add debug information
    log('🔍 Debug info:', {
      hasSidebarButton: !!sidebarButton,
      sidebarExpanded: isSidebarExpanded(),
      triggerElement: !!triggerElement,
      collapseDelay: config.collapseDelay
    });
    
    // Cancel expand timer
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      log('Expand timer cancelled');
    }
    
    // Start collapse timer only if left both trigger area and sidebar
    if (isSidebarExpanded() && sidebarButton && !isInTriggerZone && !isInSidebar) {
      log('📅 Starting collapse timer...');
      collapseTimer = setTimeout(() => {
        log('⏰ Collapse timer fired');
        if (!isInTriggerZone && !isInSidebar && isSidebarExpanded()) {
          log('🖱️ Clicking sidebar button:', sidebarButton);
          sidebarButton.click();
          log('✅ Sidebar collapsed');
          
          // After sidebar collapse, remove hover listeners
          setTimeout(() => {
            removeSidebarHoverListeners();
          }, 300); // Wait for animation to complete
        } else {
          log('❌ Collapse conditions not met:', {
            isInTriggerZone,
            isInSidebar,
            sidebarExpanded: isSidebarExpanded()
          });
        }
        collapseTimer = null;
      }, config.collapseDelay);
      
      log(`Collapse timer started (${config.collapseDelay}ms)`);
    } else {
      log('❌ Did not start collapse timer:', {
        sidebarExpanded: isSidebarExpanded(),
        hasSidebarButton: !!sidebarButton,
        isInTriggerZone,
        isInSidebar,
        reason: (!isInTriggerZone && !isInSidebar) ? 'Mouse still in one of the areas' : 'Other conditions'
      });
    }
  }

  // Check if sidebar is expanded (correct detection)
  function isSidebarExpanded() {
    // For Claude.ai:
    // - Closed state: nav element width ~3.05rem (49px)
    // - Open state: nav element width ~18rem (288px)
    
    // Find fixed position left navigation elements
    const navElements = document.querySelectorAll('nav.fixed.top-0.left-0, nav[class*="fixed"][class*="left"]');
    
    for (const nav of navElements) {
      const rect = nav.getBoundingClientRect();
      const style = window.getComputedStyle(nav);
      
      // Element fixed to left side and visible
      if (rect.left < 10 && 
          style.display !== 'none' && 
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity || '1') > 0.5) {
        
        // Judge by width: wide (~200px+) = open state, narrow (~50px-) = closed state
        const isExpanded = rect.width > 200; // 200px+ means open state
        
        if (config.debug) {
          log('📊 Sidebar expansion state check:', {
            isExpanded,
            element: nav,
            rect: { left: rect.left, width: rect.width },
            reason: `Navigation element width: ${rect.width}px ${isExpanded ? '(wide=open state)' : '(narrow=closed state)'}`
          });
        }
        
        return isExpanded;
      }
    }
    
    // Fallback: check z-sidebar class parent element
    const sidebarContainer = document.querySelector('div.fixed.z-sidebar');
    if (sidebarContainer) {
      const rect = sidebarContainer.getBoundingClientRect();
      const isExpanded = rect.width > 200; // 200px+ means open state
      
      if (config.debug) {
        log('📊 Sidebar expansion state check (fallback):', {
          isExpanded,
          element: sidebarContainer,
          rect: { width: rect.width, left: rect.left },
          reason: `Sidebar container width: ${rect.width}px`
        });
      }
      
      return isExpanded;
    }
    
    if (config.debug) {
      log('📊 Sidebar expansion state check: false (element not found)');
    }
    
    return false; // Default assumes closed state
  }

  // Monitor DOM changes
  function setupDOMObserver() {
    const observer = new MutationObserver(() => {
      // Re-search if sidebar is removed or changed
      if (!sidebar || !document.body.contains(sidebar)) {
        findSidebarElements();
      }
      
      // Re-search if button is removed
      if (!sidebarButton || !document.body.contains(sidebarButton)) {
        if (sidebar) {
          sidebarButton = findSidebarToggleButton();
        }
      }
      
      // Recreate if custom trigger element is removed
      const customTrigger = document.querySelector('.claude-custom-trigger');
      if (!customTrigger) {
        log('🔄 Custom trigger area removed, recreating');
        createCustomTriggerArea();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  // Handle keyboard shortcuts
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'toggle-sidebar') {
      log('🎹 Keyboard shortcut triggered');
      
      if (!config.enabled) {
        log('❌ Extension disabled, ignoring shortcut');
        return;
      }
      
      if (!sidebarButton) {
        log('❌ Sidebar button not found, attempting to find elements');
        findSidebarElements();
        if (!sidebarButton) {
          log('❌ Still no sidebar button found');
          return;
        }
      }
      
      const isExpanded = isSidebarExpanded();
      log(`🎹 Current sidebar state: ${isExpanded ? 'expanded' : 'collapsed'}`);
      
      // Toggle sidebar
      sidebarButton.click();
      log('🎹 Sidebar toggled via keyboard shortcut');
      
      // Update hover listeners based on new state
      setTimeout(() => {
        if (isSidebarExpanded() && !sidebarHoverListeners) {
          addSidebarHoverListeners();
        } else if (!isSidebarExpanded() && sidebarHoverListeners) {
          removeSidebarHoverListeners();
        }
      }, 300); // Wait for animation
      
      sendResponse({ success: true, wasExpanded: isExpanded });
    }
  });

  // Monitor configuration changes
  chrome.storage.onChanged.addListener((changes) => {
    for (const key in changes) {
      config[key] = changes[key].newValue;
    }
    log('Configuration updated:', config);
    
    // Reflect debug mode changes
    const debugArea = document.querySelector('.claude-hover-trigger');
    if (debugArea) {
      debugArea.classList.toggle('debug', config.debug);
    }
    
    // Enable/disable toggle
    if ('enabled' in changes) {
      if (config.enabled) {
        initialize();
      } else {
        cleanup();
      }
    }
  });

  // Cleanup function
  function cleanup() {
    // Remove custom trigger element event listeners
    if (triggerElement) {
      triggerElement.removeEventListener('mouseenter', handleDirectMouseEnter);
      triggerElement.removeEventListener('mouseleave', handleDirectMouseLeave);
    }
    
    // Remove sidebar hover listeners
    removeSidebarHoverListeners();
    
    // Remove custom trigger area
    const customTrigger = document.querySelector('.claude-custom-trigger');
    if (customTrigger) customTrigger.remove();
    
    const debugArea = document.querySelector('.claude-hover-trigger');
    if (debugArea) debugArea.remove();
    
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    
    if (collapseTimer) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }
    
    isInTriggerZone = false;
    isInSidebar = false;
    sidebarButton = null;
    sidebar = null;
    triggerElement = null;
    
    log('🧹 Cleanup completed');
  }

  // Debug utilities (improved version)
  window.claudeSidebarDebug = {
    config,
    state: () => ({
      currentMouseX,
      currentMouseY,
      isInTriggerZone,
      isInSidebar,
      sidebarExpanded: isSidebarExpanded(),
      hasSidebar: !!sidebar,
      hasButton: !!sidebarButton,
      hasTriggerElement: !!triggerElement,
      hasSidebarHoverListeners: !!sidebarHoverListeners,
      hasHoverTimer: !!hoverTimer,
      hasCollapseTimer: !!collapseTimer,
      sidebarRect: sidebar ? sidebar.getBoundingClientRect() : null,
      buttonRect: sidebarButton ? sidebarButton.getBoundingClientRect() : null,
      triggerRect: triggerElement ? triggerElement.getBoundingClientRect() : null,
      sidebarHoverElement: sidebarHoverListeners ? sidebarHoverListeners.element : null,
      windowSize: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }),
    elements: () => ({
      sidebar,
      sidebarButton,
      triggerElement,
      allSidebars: document.querySelectorAll('nav, aside, [role="navigation"]'),
      allButtons: document.querySelectorAll('button, [role="button"]'),
      allTriggerCandidates: document.querySelectorAll('div.h-full.w-full.cursor-pointer.absolute.top-0.z-sidebar, div[class*="z-sidebar"], div.cursor-pointer, .claude-custom-trigger')
    }),
    findSidebarElements,
    isSidebarExpanded,
    logDOMStructure,
    logButtonCandidates,
    toggleDebug: () => {
      config.debug = !config.debug;
      chrome.storage.sync.set({ debug: config.debug });
      const debugArea = document.querySelector('.claude-hover-trigger');
      if (debugArea) {
        debugArea.classList.toggle('debug', config.debug);
      }
      log('🐛 Debug mode:', config.debug);
      
      if (config.debug) {
        log('🔍 Detailed debug information enabled');
        logDOMStructure();
        logButtonCandidates();
      }
    },
    forceExpand: () => {
      if (sidebarButton) {
        log('🔨 Attempting force expand...', sidebarButton);
        sidebarButton.click();
        log('🔨 Force expand executed');
        setTimeout(() => {
          log('📊 State after expansion:', {
            expanded: isSidebarExpanded(),
            sidebarRect: sidebar ? sidebar.getBoundingClientRect() : null
          });
        }, 500);
      } else {
        log('❌ Cannot force expand - sidebar button not found');
        findSidebarElements(); // Attempt re-search
      }
    },
    forceCollapse: () => {
      if (sidebarButton && isSidebarExpanded()) {
        log('🔨 Attempting force collapse...', sidebarButton);
        sidebarButton.click();
        log('🔨 Force collapse executed');
        setTimeout(() => {
          log('📊 State after collapse:', {
            expanded: isSidebarExpanded(),
            sidebarRect: sidebar ? sidebar.getBoundingClientRect() : null
          });
        }, 500);
      } else if (!sidebarButton) {
        log('❌ Cannot force collapse - sidebar button not found');
      } else {
        log('❌ Cannot collapse - sidebar is not expanded');
      }
    },
    simulate: {
      mouseEnter: () => {
        log('🧪 Simulate mouse enter to trigger element');
        if (triggerElement) {
          handleDirectMouseEnter();
        } else {
          log('❌ Cannot simulate - trigger element not found');
        }
      },
      mouseLeave: () => {
        log('🧪 Simulate mouse leave from trigger element');
        if (triggerElement) {
          handleDirectMouseLeave();
        } else {
          log('❌ Cannot simulate - trigger element not found');
        }
      },
      clickButton: () => {
        log('🧪 Simulate sidebar button click');
        if (sidebarButton) {
          log('🖱️ Executing click:', sidebarButton);
          sidebarButton.click();
          log('✅ Click completed');
        } else {
          log('❌ Cannot click - sidebar button not found');
        }
      },
      testAll: () => {
        log('🧪 Full system test starting');
        log('📊 Current state:', {
          hasTriggerElement: !!triggerElement,
          hasSidebarButton: !!sidebarButton,
          hasSidebar: !!sidebar,
          sidebarExpanded: isSidebarExpanded()
        });
        
        if (triggerElement) {
          log('🎯 Trigger element:', triggerElement.className);
        }
        if (sidebarButton) {
          log('🎯 Sidebar button:', sidebarButton.className);
        }
        
        // Force click test
        if (sidebarButton) {
          log('🧪 Executing force click test');
          sidebarButton.click();
        }
      }
    },
    inspect: {
      sidebar: () => {
        if (sidebar) {
          console.log('🎯 Current sidebar element:', sidebar);
          console.log('📏 Sidebar position:', sidebar.getBoundingClientRect());
          console.log('🎨 Sidebar styles:', window.getComputedStyle(sidebar));
        } else {
          console.log('❌ Sidebar element not found');
        }
      },
      button: () => {
        if (sidebarButton) {
          console.log('🎯 Current button element:', sidebarButton);
          console.log('📏 Button position:', sidebarButton.getBoundingClientRect());
          console.log('🎨 Button styles:', window.getComputedStyle(sidebarButton));
        } else {
          console.log('❌ Button element not found');
        }
      },
      trigger: () => {
        if (triggerElement) {
          console.log('🎯 Current trigger element:', triggerElement);
          console.log('📏 Trigger position:', triggerElement.getBoundingClientRect());
          console.log('🎨 Trigger styles:', window.getComputedStyle(triggerElement));
          console.log('🔗 Trigger classes:', triggerElement.className);
        } else {
          console.log('❌ Trigger element not found');
          console.log('🔍 Candidate elements:', document.querySelectorAll('div.h-full.w-full.cursor-pointer.absolute.top-0.z-sidebar, div[class*="z-sidebar"], div.cursor-pointer, .claude-custom-trigger'));
        }
      }
    },
    refresh: () => {
      log('🔄 Re-searching elements...');
      cleanup();
      setTimeout(() => {
        initialize();
        log('🔄 Re-initialization completed');
      }, 100);
    }
  };

})();
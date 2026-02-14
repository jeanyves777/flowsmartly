/**
 * FlowSmartly Analytics Tracking Pixel
 * Version: 1.0.0
 *
 * Usage:
 * <script src="https://yourdomain.com/fs-analytics.js" data-site="your-site-id"></script>
 */

(function() {
  'use strict';

  // Configuration
  var ENDPOINT = '/api/analytics/collect';
  var VISITOR_KEY = 'fs_vid';
  var SESSION_KEY = 'fs_sid';
  var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  // State
  var visitorId = null;
  var sessionId = null;
  var lastActivity = Date.now();
  var pageLoadTime = Date.now();

  // Utility functions
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + value + expires + '; path=/; SameSite=Lax';
  }

  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getUrlParams() {
    var params = {};
    var search = window.location.search.substring(1);
    if (search) {
      search.split('&').forEach(function(param) {
        var parts = param.split('=');
        params[parts[0]] = decodeURIComponent(parts[1] || '');
      });
    }
    return params;
  }

  function send(data) {
    // Add common data
    data.visitorId = visitorId;
    data.sessionId = sessionId;
    data.timestamp = new Date().toISOString();

    // Use sendBeacon if available (better for page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(data));
    } else {
      // Fallback to fetch
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function() {});
    }

    lastActivity = Date.now();
  }

  // Initialize visitor and session
  function init() {
    // Get or create visitor ID
    visitorId = getCookie(VISITOR_KEY);
    if (!visitorId) {
      visitorId = generateId();
      setCookie(VISITOR_KEY, visitorId, 365);
    }

    // Get or create session ID
    sessionId = getCookie(SESSION_KEY);
    var sessionStart = getCookie(SESSION_KEY + '_start');

    if (!sessionId || !sessionStart || (Date.now() - parseInt(sessionStart)) > SESSION_TIMEOUT) {
      sessionId = generateId();
      setCookie(SESSION_KEY, sessionId, 1); // Session cookie
      setCookie(SESSION_KEY + '_start', Date.now().toString(), 1);
    }

    // Track initial page view
    trackPageView();

    // Set up event listeners
    setupListeners();
  }

  // Track page view
  function trackPageView() {
    var params = getUrlParams();
    var loadTime = window.performance ? Math.round(performance.now()) : null;

    send({
      type: 'pageview',
      path: window.location.pathname + window.location.search,
      title: document.title,
      referrer: document.referrer,
      utmSource: params.utm_source,
      utmMedium: params.utm_medium,
      utmCampaign: params.utm_campaign,
      utmTerm: params.utm_term,
      utmContent: params.utm_content,
      loadTime: loadTime,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language
    });
  }

  // Track custom event
  function trackEvent(eventName, eventCategory, eventLabel, eventValue, properties) {
    send({
      type: 'event',
      eventName: eventName,
      eventCategory: eventCategory,
      eventLabel: eventLabel,
      eventValue: eventValue,
      path: window.location.pathname,
      properties: properties
    });
  }

  // Identify visitor with contact info
  function identify(data) {
    send({
      type: 'identify',
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      company: data.company
    });
  }

  // Set up event listeners
  function setupListeners() {
    // Track page visibility changes
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        // Calculate time on page
        var timeOnPage = Math.round((Date.now() - pageLoadTime) / 1000);
        send({
          type: 'event',
          eventName: 'page_exit',
          eventCategory: 'engagement',
          eventValue: timeOnPage,
          path: window.location.pathname
        });
      }
    });

    // Track outbound links
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (link && link.href) {
        var url = new URL(link.href, window.location.origin);
        if (url.hostname !== window.location.hostname) {
          trackEvent('outbound_link', 'click', link.href);
        }
      }
    });

    // Track form submissions
    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (form.tagName === 'FORM') {
        var formId = form.id || form.name || 'unknown';
        trackEvent('form_submit', 'form', formId);

        // Try to capture email from form
        var emailInput = form.querySelector('input[type="email"], input[name*="email"]');
        var phoneInput = form.querySelector('input[type="tel"], input[name*="phone"]');
        var nameInput = form.querySelector('input[name*="name"], input[name*="firstName"]');

        if (emailInput || phoneInput) {
          identify({
            email: emailInput ? emailInput.value : undefined,
            phone: phoneInput ? phoneInput.value : undefined,
            firstName: nameInput ? nameInput.value : undefined
          });
        }
      }
    });

    // Track scroll depth
    var scrollDepths = [25, 50, 75, 100];
    var trackedDepths = [];

    function trackScroll() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - window.innerHeight;

      if (docHeight <= 0) return;

      var scrollPercent = Math.round((scrollTop / docHeight) * 100);

      scrollDepths.forEach(function(depth) {
        if (scrollPercent >= depth && trackedDepths.indexOf(depth) === -1) {
          trackedDepths.push(depth);
          trackEvent('scroll_depth', 'engagement', depth + '%', depth);
        }
      });
    }

    var scrollTimeout;
    window.addEventListener('scroll', function() {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(trackScroll, 100);
    });

    // Track errors
    window.addEventListener('error', function(e) {
      trackEvent('js_error', 'error', e.message, null, {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
      });
    });
  }

  // Expose public API
  window.fsAnalytics = {
    track: trackEvent,
    identify: identify,
    page: trackPageView
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

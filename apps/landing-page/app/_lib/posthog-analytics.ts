const DEFAULT_HOST = 'https://us.i.posthog.com';

function trackerScript(): string {
  return `
  (function () {
    if (typeof window.posthog === 'undefined') return;

    window.__odTrack = function (name, props) {
      try {
        if (window.posthog) window.posthog.capture(name, props || {});
      } catch (e) {}
    };

    var REPO = 'github.com/nexu-io/open-design';
    var PAGE = location.pathname === '/' ? 'landing_home' : 'landing_subpage';

    var localeNow = function () {
      return (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    };

    var platformNow = function () {
      var ua = (navigator.userAgent || '').toLowerCase();
      var platform = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
      if (/win/.test(platform) || /windows/.test(ua)) return 'windows';
      if (/mac/.test(platform) || (/mac os x/.test(ua) && !/iphone|ipad|ipod/.test(ua))) return 'macos';
      if (/linux/.test(platform) || (/linux/.test(ua) && !/android/.test(ua))) return 'linux';
      return 'other';
    };

    var areaOf = function (el) {
      if (el.closest && el.closest('header.nav, [data-chrome-headroom]')) return 'header';
      var section = el.closest && el.closest('[data-od-id]');
      return section ? (section.getAttribute('data-od-id') || 'unknown') : 'unknown';
    };

    var textOf = function (el) {
      var text = (el.getAttribute && el.getAttribute('aria-label')) || el.textContent || '';
      return text.trim().replace(/\\s+/g, ' ').slice(0, 80);
    };

    var click = function (el, element, extra) {
      var props = { page_name: PAGE, locale: localeNow(), area: areaOf(el), element: element };
      if (extra) for (var key in extra) props[key] = extra[key];
      window.__odTrack('landing_home_click', props);
    };

    window.__odTrack('page_view', { page_name: PAGE, locale: localeNow() });

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var localeLink = target.closest('[data-locale-link]');
      if (localeLink) {
        click(localeLink, 'language_switch', { lang_to: localeLink.getAttribute('data-locale-code') || '' });
        return;
      }
      if (target.closest('[data-locale-switch] summary')) {
        click(target, 'language_menu');
        return;
      }

      var copyEl = target.closest('[data-share-copy], [data-copy-link], [data-copy-command]');
      if (copyEl) {
        click(copyEl, 'share_copy');
        return;
      }

      var link = target.closest('a[href]');
      if (!link) return;
      var href = link.href || '';
      var lowerHref = href.toLowerCase();
      var lowerLabel = textOf(link).toLowerCase();

      if (lowerHref.indexOf(REPO + '/releases') !== -1 || /\\.(dmg|exe|appimage|deb|zip)(\\?|$)/.test(lowerHref)) {
        click(link, 'download_desktop', { platform: platformNow(), link_url: href });
        return;
      }
      if (lowerHref === 'https://' + REPO || lowerHref === 'https://' + REPO + '/' || lowerLabel.indexOf('star') !== -1) {
        click(link, 'star_us_on_github', { link_url: href });
        return;
      }
      if (lowerHref.indexOf('discord.gg/') !== -1) {
        click(link, 'join_discord', { link_url: href });
        return;
      }
      if (lowerHref.indexOf(REPO + '/issues') !== -1) {
        click(link, 'open_issue', { link_url: href });
        return;
      }
      if (link.closest('[data-nav-primary]')) {
        click(link, 'nav_link', { link_text: textOf(link), link_url: href });
      }
    });

    document.addEventListener('toggle', function (event) {
      var details = event.target;
      if (!details || !details.closest || !details.closest('li.faq-item')) return;
      var summary = details.querySelector ? details.querySelector('summary') : null;
      click(details, details.open ? 'faq_open' : 'faq_close', {
        question: summary ? (summary.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80) : ''
      });
    }, true);
  })();`;
}

export function posthogHeadHtml(apiKey: string | undefined, host: string | undefined): string {
  const key = apiKey?.trim();
  if (!key) return '';
  const apiHost = (host?.trim() || DEFAULT_HOST).replace(/\/+$/, '');

  return `<!-- PostHog -->
<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init(${JSON.stringify(key)}, {
    api_host: ${JSON.stringify(apiHost)},
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: 'localStorage+cookie'
  });
${trackerScript()}
</script>`;
}

export function injectPostHog(html: string, apiKey: string | undefined, host: string | undefined): string {
  const headHtml = posthogHeadHtml(apiKey, host);
  if (!headHtml || html.includes('posthog.init(')) return html;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${headHtml}\n</head>`);
  }
  return `${headHtml}\n${html}`;
}

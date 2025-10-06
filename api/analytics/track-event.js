import pg from 'pg';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// User agent parser for device detection
function parseUserAgent(userAgent) {
  if (!userAgent) return {};

  const ua = userAgent.toLowerCase();

  // Detect browser
  let browser = 'Unknown';
  let browserVersion = '';
  if (ua.includes('firefox')) {
    browser = 'Firefox';
    browserVersion = ua.match(/firefox\/(\d+\.\d+)/)?.[1] || '';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
    browserVersion = ua.match(/edg\/(\d+\.\d+)/)?.[1] || '';
  } else if (ua.includes('chrome')) {
    browser = 'Chrome';
    browserVersion = ua.match(/chrome\/(\d+\.\d+)/)?.[1] || '';
  } else if (ua.includes('safari')) {
    browser = 'Safari';
    browserVersion = ua.match(/version\/(\d+\.\d+)/)?.[1] || '';
  }

  // Detect OS
  let os = 'Unknown';
  let osVersion = '';
  if (ua.includes('windows')) {
    os = 'Windows';
    osVersion = ua.match(/windows nt (\d+\.\d+)/)?.[1] || '';
  } else if (ua.includes('mac os')) {
    os = 'macOS';
    osVersion = ua.match(/mac os x (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
    osVersion = ua.match(/android (\d+\.\d+)/)?.[1] || '';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
    osVersion = ua.match(/os (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  }

  // Detect device type
  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
    deviceVendor: ua.includes('apple') ? 'Apple' : (ua.includes('samsung') ? 'Samsung' : null),
    deviceModel: null // Would need more sophisticated parsing
  };
}

// Extract referrer information
function parseReferrer(referrerUrl) {
  if (!referrerUrl) return { source: 'direct', url: null };

  try {
    const url = new URL(referrerUrl);
    const hostname = url.hostname.toLowerCase();

    // Search engines
    if (hostname.includes('google')) return { source: 'google', url: referrerUrl };
    if (hostname.includes('bing')) return { source: 'bing', url: referrerUrl };
    if (hostname.includes('yahoo')) return { source: 'yahoo', url: referrerUrl };
    if (hostname.includes('duckduckgo')) return { source: 'duckduckgo', url: referrerUrl };

    // Social media
    if (hostname.includes('facebook')) return { source: 'facebook', url: referrerUrl };
    if (hostname.includes('twitter') || hostname.includes('t.co')) return { source: 'twitter', url: referrerUrl };
    if (hostname.includes('linkedin')) return { source: 'linkedin', url: referrerUrl };
    if (hostname.includes('instagram')) return { source: 'instagram', url: referrerUrl };
    if (hostname.includes('reddit')) return { source: 'reddit', url: referrerUrl };

    // Same site
    if (hostname.includes('proofofputt')) return { source: 'internal', url: referrerUrl };

    // External referral
    return { source: 'referral', url: referrerUrl };
  } catch (e) {
    return { source: 'direct', url: referrerUrl };
  }
}

// Extract UTM parameters from URL
function extractUtmParams(url) {
  if (!url) return {};

  try {
    const urlObj = new URL(url);
    return {
      utmSource: urlObj.searchParams.get('utm_source'),
      utmMedium: urlObj.searchParams.get('utm_medium'),
      utmCampaign: urlObj.searchParams.get('utm_campaign'),
      utmTerm: urlObj.searchParams.get('utm_term'),
      utmContent: urlObj.searchParams.get('utm_content')
    };
  } catch (e) {
    return {};
  }
}

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      // Event data
      eventType,
      eventName,
      eventCategory,
      eventProperties,

      // Page context
      pageUrl,
      pageTitle,
      pagePath,
      referrerUrl,

      // Session tracking
      sessionId,
      visitorId,
      playerId, // Optional - if user is authenticated

      // Client data
      userAgent,
      screenResolution,
      viewportSize,
      clientTimestamp,
      pageLoadTime,
      timeOnPage,

      // A/B testing
      experimentId,
      variantId
    } = req.body;

    // Validation
    if (!eventType || !eventName || !sessionId || !pageUrl) {
      return res.status(400).json({
        error: 'Missing required fields: eventType, eventName, sessionId, pageUrl'
      });
    }

    // Parse user agent
    const deviceInfo = parseUserAgent(userAgent || req.headers['user-agent']);

    // Parse referrer
    const referrerInfo = parseReferrer(referrerUrl);

    // Extract UTM parameters
    const utmParams = extractUtmParams(pageUrl);

    // Get client IP (respecting proxies)
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                      req.headers['x-real-ip'] ||
                      req.connection?.remoteAddress ||
                      req.socket?.remoteAddress;

    // Note: For production, you'd want to use a geolocation service like MaxMind or ipapi.co
    // For now, we'll leave geo fields null and can add them later
    const geoData = {
      countryCode: null,
      countryName: null,
      region: null,
      city: null,
      timezone: null
    };

    // Insert event into database
    const query = `
      INSERT INTO analytics_events (
        event_type, event_name, event_category, event_properties,
        page_url, page_title, page_path, referrer_url, referrer_source,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        session_id, visitor_id, player_id,
        user_agent, browser, browser_version, os, os_version,
        device_type, device_vendor, device_model,
        screen_resolution, viewport_size,
        ip_address, country_code, country_name, region, city, timezone,
        client_timestamp, page_load_time, time_on_page,
        experiment_id, variant_id
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25,
        $26, $27,
        $28, $29, $30, $31, $32, $33,
        $34, $35, $36,
        $37, $38
      ) RETURNING event_id
    `;

    const values = [
      eventType,
      eventName,
      eventCategory,
      eventProperties ? JSON.stringify(eventProperties) : null,
      pageUrl,
      pageTitle,
      pagePath || new URL(pageUrl).pathname,
      referrerInfo.url,
      referrerInfo.source,
      utmParams.utmSource,
      utmParams.utmMedium,
      utmParams.utmCampaign,
      utmParams.utmTerm,
      utmParams.utmContent,
      sessionId,
      visitorId,
      playerId || null,
      userAgent || req.headers['user-agent'],
      deviceInfo.browser,
      deviceInfo.browserVersion,
      deviceInfo.os,
      deviceInfo.osVersion,
      deviceInfo.deviceType,
      deviceInfo.deviceVendor,
      deviceInfo.deviceModel,
      screenResolution,
      viewportSize,
      ipAddress,
      geoData.countryCode,
      geoData.countryName,
      geoData.region,
      geoData.city,
      geoData.timezone,
      clientTimestamp ? new Date(clientTimestamp) : null,
      pageLoadTime,
      timeOnPage,
      experimentId,
      variantId
    ];

    const result = await pool.query(query, values);
    const eventId = result.rows[0].event_id;

    // Update session summary asynchronously (don't wait for it)
    pool.query('SELECT update_analytics_session($1)', [sessionId]).catch(err => {
      console.error('Error updating session summary:', err);
    });

    // Return success
    res.status(200).json({
      success: true,
      eventId,
      message: 'Event tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({
      error: 'Failed to track event',
      message: error.message
    });
  }
}

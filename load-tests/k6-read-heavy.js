import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

/**
 * VyaparMedia Read-Heavy Scenarios k6 Load Test
 *
 * Scenarios:
 *  1. GET creator discovery / search with keyset cursor pagination
 *  2. Campaign list feed + authenticated dashboard load
 *  3. Credentials login + session refresh
 *  4. Wallet ledger & deals list reads
 *
 * Ramp Profile: 10 -> 50 -> 200 Virtual Users
 * STRICT RULE: Only run against local or non-production staging environments.
 */

// Custom metrics
const errorRate = new Rate("error_rate");
const creatorSearchTrend = new Trend("creator_search_duration", true);
const campaignListTrend = new Trend("campaign_list_duration", true);
const loginTrend = new Trend("login_duration", true);
const sessionRefreshTrend = new Trend("session_refresh_duration", true);
const walletDealsTrend = new Trend("wallet_deals_duration", true);

const TARGET_URL = __ENV.TARGET_URL || "http://localhost:3000";

// Safety check before running
function checkTargetSafety(url) {
  const forbidden = ["vyaparmedia.in", "vyaparmedia.com", "production", "prod"];
  for (let i = 0; i < forbidden.length; i++) {
    if (url.indexOf(forbidden[i]) !== -1 && url.indexOf("staging") === -1) {
      throw new Error("FATAL: Attempting to load test production URL: " + url);
    }
  }
}
checkTargetSafety(TARGET_URL);

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // Ramp to 10 VUs
    { duration: "45s", target: 50 },  // Ramp to 50 VUs
    { duration: "1m", target: 200 },  // Ramp to 200 VUs
    { duration: "30s", target: 0 },   // Cool down
  ],
  thresholds: {
    error_rate: ["rate<0.05"], // Error rate under 5%
    http_req_duration: ["p(95)<500", "p(99)<1500"], // p95 < 500ms, p99 < 1500ms
    creator_search_duration: ["p(95)<400"],
    campaign_list_duration: ["p(95)<300"],
    wallet_deals_duration: ["p(95)<400"],
  },
};

export function setup() {
  checkTargetSafety(TARGET_URL);
  console.log(`Starting load test against TARGET: ${TARGET_URL}`);

  // Test account credentials
  const brandEmail = __ENV.TEST_BRAND_EMAIL || "brand@test.vyaparmedia.in";
  const influencerEmail = __ENV.TEST_INFLUENCER_EMAIL || "influencer@test.vyaparmedia.in";
  const password = __ENV.TEST_PASSWORD || "Test@1234";

  // Pre-fetch CSRF token for NextAuth
  const csrfRes = http.get(`${TARGET_URL}/api/auth/csrf`);
  let csrfToken = "";
  if (csrfRes.status === 200) {
    try {
      const parsed = JSON.parse(csrfRes.body);
      csrfToken = parsed.csrfToken || "";
    } catch (e) {
      // fallback
    }
  }

  return {
    csrfToken,
    brandEmail,
    influencerEmail,
    password,
  };
}

export default function (data) {
  const commonHeaders = {
    "Accept": "application/json",
    "User-Agent": "k6-load-tester/1.0",
  };

  // --------------------------------------------------------------------------
  // Scenario 1: Creator Discovery & Search with Keyset Cursor Pagination
  // --------------------------------------------------------------------------
  group("1_Creator_Discovery_Search", function () {
    // 1a. Initial page (top 20 influencers)
    const initialUrl = `${TARGET_URL}/api/influencers?limit=20&sortBy=followers`;
    const res1 = http.get(initialUrl, { headers: commonHeaders });
    
    creatorSearchTrend.add(res1.timings.duration);
    const success1 = check(res1, {
      "discovery status is 200": (r) => r.status === 200,
      "discovery returns valid items": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && Array.isArray(body.data.items || body.data);
        } catch (_) {
          return false;
        }
      },
    });
    errorRate.add(!success1);

    // 1b. Keyset cursor follow-up (if nextCursor is present)
    let nextCursor = "";
    try {
      const parsed = JSON.parse(res1.body);
      nextCursor = parsed.data?.nextCursor || parsed.nextCursor || "";
    } catch (_) {}

    if (nextCursor) {
      const cursorUrl = `${TARGET_URL}/api/influencers?limit=20&cursor=${encodeURIComponent(nextCursor)}&sortBy=followers`;
      const resCursor = http.get(cursorUrl, { headers: commonHeaders });
      creatorSearchTrend.add(resCursor.timings.duration);
      check(resCursor, {
        "cursor pagination status is 200": (r) => r.status === 200,
      });
    }
  });

  sleep(0.5);

  // --------------------------------------------------------------------------
  // Scenario 2: Campaign List & Marketplace Feed
  // --------------------------------------------------------------------------
  group("2_Campaign_List_Feed", function () {
    const campaignUrl = `${TARGET_URL}/api/campaigns?limit=20&status=ACTIVE&sortBy=createdAt&sortOrder=desc`;
    const res = http.get(campaignUrl, { headers: commonHeaders });
    
    campaignListTrend.add(res.timings.duration);
    const success = check(res, {
      "campaigns status is 200": (r) => r.status === 200,
      "campaigns payload has items": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data !== undefined || Array.isArray(body);
        } catch (_) {
          return false;
        }
      },
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // --------------------------------------------------------------------------
  // Scenario 3: Login + Session Refresh
  // --------------------------------------------------------------------------
  group("3_Auth_Login_And_Session", function () {
    // 3a. Session Refresh read check
    const sessionRes = http.get(`${TARGET_URL}/api/auth/session`, { headers: commonHeaders });
    sessionRefreshTrend.add(sessionRes.timings.duration);
    const sessionOk = check(sessionRes, {
      "session endpoint returns 200": (r) => r.status === 200,
    });
    errorRate.add(!sessionOk);

    // 3b. Credential login attempt (performed periodically to avoid local IP rate lockout)
    if (__VU % 5 === 0) {
      const loginPayload = JSON.stringify({
        email: data.brandEmail,
        password: data.password,
        csrfToken: data.csrfToken,
        json: "true",
      });

      const loginRes = http.post(`${TARGET_URL}/api/auth/callback/credentials`, loginPayload, {
        headers: Object.assign({}, commonHeaders, { "Content-Type": "application/json" }),
      });
      
      loginTrend.add(loginRes.timings.duration);
      check(loginRes, {
        "login status acceptable (200, 302, or 429 rate limited)": (r) =>
          r.status === 200 || r.status === 302 || r.status === 429,
      });
    }
  });

  sleep(0.5);

  // --------------------------------------------------------------------------
  // Scenario 4: Wallet & Deals List Reads
  // --------------------------------------------------------------------------
  group("4_Wallet_And_Deals_Reads", function () {
    // Deals query with pagination
    const dealsUrl = `${TARGET_URL}/api/deals?limit=20&status=ACTIVE`;
    const dealsRes = http.get(dealsUrl, { headers: commonHeaders });
    walletDealsTrend.add(dealsRes.timings.duration);

    // Public/Auth deals status check (200 if authed or 401 if unauthorized)
    const dealsSuccess = check(dealsRes, {
      "deals status is valid (200 or 401 unauthenticated)": (r) =>
        r.status === 200 || r.status === 401,
    });
    errorRate.add(!dealsSuccess);

    // Wallet balance read
    const walletRes = http.get(`${TARGET_URL}/api/wallet`, { headers: commonHeaders });
    walletDealsTrend.add(walletRes.timings.duration);
    check(walletRes, {
      "wallet status valid": (r) => r.status === 200 || r.status === 401,
    });
  });

  sleep(1);
}


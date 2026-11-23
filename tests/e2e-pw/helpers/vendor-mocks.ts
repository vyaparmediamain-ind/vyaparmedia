import type { Page, Route } from "@playwright/test";

/**
 * Intercepts external third-party vendor network traffic to ensure E2E tests
 * are 100% deterministic, offline-capable, and do not hit external third-party rate limits.
 */
export async function installVendorMocks(page: Page, options: { autoDismissConsent?: boolean } = { autoDismissConsent: true }): Promise<void> {
  if (options.autoDismissConsent !== false) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vm_telemetry_banner_dismissed_v1", "true");
      } catch {}
    });
  }
  // 1. Shiprocket Logistics API
  await page.route(/https:\/\/.*shiprocket\.co\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: 200,
        awb_code: "SR_MOCK_123456789",
        courier_name: "Mock Courier Express",
        tracking_data: {
          track_status: 1,
          shipment_status_id: 17,
          shipment_status: "DELIVERED",
        },
      }),
    });
  });

  // 2. Razorpay Payment Gateway API & Webhook/Orders
  await page.route(/https:\/\/api\.razorpay\.com\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "order_mock_" + Math.random().toString(36).substring(7),
        entity: "order",
        amount: 500000,
        currency: "INR",
        status: "paid",
        attempts: 1,
        created_at: Math.floor(Date.now() / 1000),
      }),
    });
  });

  // Razorpay Checkout JS SDK stub
  await page.route(/https:\/\/checkout\.razorpay\.com\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        window.Razorpay = function(options) {
          return {
            open: function() {
              if (options.handler) {
                options.handler({
                  razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(7),
                  razorpay_order_id: options.order_id || "order_mock_123",
                  razorpay_signature: "sig_mock_verified_signature"
                });
              }
            },
            on: function() {}
          };
        };
      `,
    });
  });

  // 3. Instagram / Meta Graph API
  await page.route(/https:\/\/graph\.(instagram|facebook)\.com\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "meta_mock_178414000000000",
        username: "priyasharma.official",
        followers_count: 85000,
        media_count: 142,
        insights: {
          data: [
            { name: "impressions", values: [{ value: 340000 }] },
            { name: "reach", values: [{ value: 125000 }] },
          ],
        },
      }),
    });
  });

  // Instagram OAuth authorize endpoint stub
  await page.route(/https:\/\/(www\.)?(api\.)?instagram\.com\/oauth\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body><script>window.location.href='/api/auth/instagram/callback?code=mock_ig_code&state=mock_state';</script></body></html>",
    });
  });

  // 4. Google OAuth / YouTube API
  await page.route(/https:\/\/accounts\.google\.com\/o\/oauth2\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body><script>window.location.href='/api/auth/youtube/callback?code=mock_yt_code&state=mock_state';</script></body></html>",
    });
  });

  await page.route(/https:\/\/www\.googleapis\.com\/youtube\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "UC_mock_channel_id",
            statistics: {
              viewCount: "1500000",
              subscriberCount: "42000",
              videoCount: "85",
            },
          },
        ],
      }),
    });
  });

  // 5. Surepass KYC / Aadhaar / PAN Verification API
  await page.route(/https:\/\/.*surepass\.io\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status_code: 200,
        success: true,
        data: {
          client_id: "surepass_client_mock_123",
          pan_number: "ABCDE1234F",
          full_name: "Priya Sharma",
          status: "VALID",
        },
      }),
    });
  });

  // 6. DigiLocker API
  await page.route(/https:\/\/.*digitallocker\.gov\.in\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        doc_type: "AADHAAR",
        verified: true,
      }),
    });
  });

  // 7. MSG91 / Fast2SMS SMS Gateways
  await page.route(/https:\/\/.*(msg91|fast2sms)\.com\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "success",
        message: "SMS sent successfully (mocked)",
      }),
    });
  });

  // 8. Resend Email Service API
  await page.route(/https:\/\/api\.resend\.com\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "email_resend_mock_" + Math.random().toString(36).substring(7),
        from: "notifications@vyaparmedia.in",
        to: "user@example.com",
      }),
    });
  });
}

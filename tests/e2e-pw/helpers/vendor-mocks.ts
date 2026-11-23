import type { Page, Route } from "@playwright/test";

/**
 * Intercepts external third-party vendor network traffic to ensure E2E tests
 * are 100% deterministic, offline-capable, and do not hit external third-party rate limits.
 */
export async function installVendorMocks(page: Page): Promise<void> {
  // Shiprocket Logistics API
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

  // Razorpay Payment Gateway API
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
      }),
    });
  });

  // Instagram / Meta Graph API
  await page.route(/https:\/\/graph\.(instagram|facebook)\.com\/.*/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "meta_mock_178414000000000",
        username: "mock_creator",
        followers_count: 85000,
        media_count: 142,
      }),
    });
  });

  // MSG91 / Fast2SMS SMS Gateways
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
}

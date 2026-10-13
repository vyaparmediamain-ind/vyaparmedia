import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { routeParamsSchema, productFulfillmentSchema } from "@/lib/validations";
import { DealService } from "@/services/deal.service";
import { checkRateLimit } from "@/lib/rate-limit";

const paramsSchema = routeParamsSchema;

async function _handler_POST(
request: NextRequest,
{ params }: { params: Promise<Record<string, string | string[]>> },
) {
const parsedParams = paramsSchema.safeParse(await params);
if (!parsedParams.success) {
return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
}

const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "DEAL_UPDATES");
if (!limit.success) {
return NextResponse.json({ error: "Too many deal update requests" }, { status: 429 });
}

const body = await request.json().catch(() => null);
const parsedBody = productFulfillmentSchema.safeParse(body);
if (!parsedBody.success) {
return NextResponse.json(
{ error: "Validation failed", details: parsedBody.error.flatten() },
{ status: 400 },
);
}

const dealId = parsedParams.data.id;
const userId = session.user.id;
const payload = parsedBody.data;

let deal;
let shipment;
switch (payload.action) {
case "submit_address":
deal = await DealService.submitShippingAddress(userId, dealId, payload.address);
break;
case "create_shiprocket_shipment":
const result = await DealService.createShiprocketShipment(userId, dealId, {
pickupLocation: payload.pickupLocation,
length: payload.length,
breadth: payload.breadth,
height: payload.height,
weight: payload.weight,
});
deal = result.deal;
shipment = result.shipment;
break;
case "confirm_dispatch":
deal = await DealService.confirmProductDispatch(userId, dealId, {
trackingNumber: payload.trackingNumber,
...(payload.carrier ? { carrier: payload.carrier } : {}),
});
break;
default:
deal = await DealService.confirmProductReceived(userId, dealId);
}

return NextResponse.json({ success: true, deal, ...(shipment ? { shipment } : {}) });
}

async function _handler_GET(
request: NextRequest,
{ params }: { params: Promise<Record<string, string | string[]>> },
) {
const parsedParams = paramsSchema.safeParse(await params);
if (!parsedParams.success) {
return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
}

const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const dealId = parsedParams.data.id;
const trackingData = await DealService.trackDealShipping(session.user.id, dealId);

return NextResponse.json({
success: true,
deal: trackingData.deal,
tracking: trackingData.tracking,
});
}

// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
export const GET = apiWrapper(_handler_GET);

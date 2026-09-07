import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AppError } from "./errors";

export function handleApplicationError(error: unknown, defaultMessage: string, loggerLabel: string) {
logger.error(loggerLabel, error);

if (error instanceof AppError) {
return NextResponse.json(
{ success: false, message: error.message },
{ status: error.statusCode },
);
}

const errorMsg = error instanceof Error ? error.message : String(error);

if (errorMsg.includes("not found") || errorMsg.includes("Not authorized")) {
return NextResponse.json(
{ success: false, message: errorMsg },
{ status: 404 },
);
}

const badRequestStrings = ["Insufficient", "budget", "pending", "authenticity", "Authenticity", "score"];
if (badRequestStrings.some((s) => errorMsg.includes(s))) {
return NextResponse.json(
{ success: false, message: errorMsg },
{ status: 400 },
);
}

return NextResponse.json(
{ success: false, message: defaultMessage },
{ status: 500 },
);
}

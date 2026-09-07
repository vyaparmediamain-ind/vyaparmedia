import { Prisma } from "@prisma/client";
import { AdminService } from "@/services/admin.service";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button } from "@/components/ui";

type PendingUserElement = Prisma.PromiseReturnType<typeof AdminService.getVerificationQueue>[number];

interface VerificationQueueProps {
pendingUsers: PendingUserElement[];
isNarrow?: boolean;
}

export default function VerificationQueue({ pendingUsers, isNarrow = false }: Readonly<VerificationQueueProps>) {
return (
<div className={`verification-queue-container ${isNarrow ? "narrow-width" : ""}`}>
{pendingUsers.length === 0 ? (
<EmptyState
emoji=""
title="All Caught Up!"
description="There are no pending verification requests at this moment."
compact={!isNarrow}
/>
) : (
<div className="flex flex-col gap-4">
{pendingUsers.map((user) => {
const name =
user.influencerProfile?.displayName ||
user.brandProfile?.companyName ||
"Unknown User";

return (
<div
key={user.id}
className="card hover-lift vq-card"
>
<div className="vq-user-info">
<div
className="avatar"
data-type={user.userType.toLowerCase()}
>
{name[0]}
</div>
<div>
<div className="vq-user-name">{name}</div>
<div className="vq-user-meta">
<Badge variant="primary" className="vq-badge-xs">{user.userType}</Badge>
<span>{user.email}</span>
</div>
</div>
</div>

<div className="vq-actions">
<div className="vq-stat">
<div className="vq-stat-label">Tax</div>
<div className="vq-stat-value">
{user.taxCompliance?.panLast4 ? (
<span className="text-emerald">PAN ****{user.taxCompliance.panLast4}</span>
) : (
<span className="text-rose">PAN missing</span>
)}
</div>
</div>

<div className="vq-stat">
<div className="vq-stat-label">Documents</div>
<div className="vq-stat-value">
{user.verificationDocs.length > 0 ? (
<span className="text-emerald">{user.verificationDocs.length} Attached </span>
) : (
<span className="text-amber">0 Attached </span>
)}
</div>
</div>

<Button
href={`/admin/verifications/${user.id}`}
variant="primary"
size="sm"
aria-label={`Review verification for ${name}`}
>
Review
</Button>
</div>
</div>
);
})}
</div>
)}
</div>
);
}

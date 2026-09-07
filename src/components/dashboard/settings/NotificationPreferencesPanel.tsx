"use client";

import { Button } from "@/components/ui";

export interface NotificationPreferences {
email: {
marketing: boolean;
updates: boolean;
security: boolean;
};
push: {
marketing: boolean;
updates: boolean;
security: boolean;
};
}

type NotificationCategory = "marketing" | "updates" | "security";

interface NotificationPreferencesPanelProps {
preferences: NotificationPreferences;
isSaving: boolean;
onToggle: (
type: "email" | "push",
category: NotificationCategory,
) => void;
onSave: () => void;
}

const notificationLabels: Record<NotificationCategory, string> = {
marketing: "Marketing",
updates: "Product updates",
security: "Security alerts",
};

export default function NotificationPreferencesPanel({
preferences,
isSaving,
onToggle,
onSave,
}: Readonly<NotificationPreferencesPanelProps>) {
return (
<div className="card max-w-800">
<h2
className="text-xl font-bold mb-6"
>
Notification Preferences
</h2>

<PreferenceGroup
title="Email notifications"
type="email"
values={preferences.email}
onToggle={onToggle}
/>


<div className="flex justify-end">
<Button
type="button"
variant="primary"
onClick={onSave}
disabled={isSaving}
>
{isSaving ? "Saving..." : "Save Preferences"}
</Button>
</div>
</div>
);
}

function PreferenceGroup({
title,
type,
values,
onToggle,
}: Readonly<{
title: string;
type: "email" | "push";
values: NotificationPreferences["email"];
onToggle: NotificationPreferencesPanelProps["onToggle"];
}>) {
return (
<section className="mb-8">
<h4
className="text-base font-semibold mb-4"
>
{title}
</h4>
<div
className="flex flex-col gap-4"
>
{Object.entries(values).map(([key, value]) => {
const category = key as NotificationCategory;
return (
<div
key={key}
className="flex items-center justify-between gap-4 p-3 bg-tertiary rounded-sm"
>
<div>
<div className="font-semibold">
{notificationLabels[category]}
</div>
<div
className="text-sm text-secondary"
>
Receive {notificationLabels[category].toLowerCase()} by{" "}
{type === "email" ? "email" : "push notification"}.
</div>
</div>
<Toggle
checked={value}
label={`${title}: ${notificationLabels[category]}`}
onChange={() => onToggle(type, category)}
/>
</div>
);
})}
</div>
</section>
);
}

function Toggle({
checked,
label,
onChange,
}: Readonly<{
checked: boolean;
label: string;
onChange: () => void;
}>) {
return (
<label
aria-label={label}
className="switch flex-shrink-0"
>
<input
type="checkbox"
checked={checked}
onChange={onChange}
/>
<span className="slider round" />
</label>
);
}

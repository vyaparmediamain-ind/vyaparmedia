"use client";

import type { User } from "./ProfileTab";
import ContactVerificationPanel from "./ContactVerificationPanel";
import PasswordPanel from "./PasswordPanel";
import TwoFactorAuthPanel from "./TwoFactorAuthPanel";
import LoginActivityPanel from "./LoginActivityPanel";
import DeleteAccountPanel from "./DeleteAccountPanel";

interface SecurityTabProps {
user: User;
setUser: React.Dispatch<React.SetStateAction<User | null>>;
isSaving: boolean;
setIsSaving: (val: boolean) => void;
showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function SecurityTab({
user,
setUser,
isSaving,
setIsSaving,
showToast,
}: Readonly<SecurityTabProps>) {
return (
<div
className="grid gap-6 grid-auto-300"
>
<ContactVerificationPanel
user={user}
setUser={setUser}
isSaving={isSaving}
setIsSaving={setIsSaving}
showToast={showToast}
/>

<PasswordPanel
user={user}
isSaving={isSaving}
setIsSaving={setIsSaving}
showToast={showToast}
/>

<div className="flex flex-col gap-6">
<TwoFactorAuthPanel
isSaving={isSaving}
setIsSaving={setIsSaving}
showToast={showToast}
/>

<LoginActivityPanel
showToast={showToast}
/>

<DeleteAccountPanel
isSaving={isSaving}
setIsSaving={setIsSaving}
showToast={showToast}
/>
</div>
</div>
);
}

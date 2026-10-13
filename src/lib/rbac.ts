import { UserType } from "@prisma/client";

export type Permission =
// Dashboard & Navigation
| "VIEW_DASHBOARD"
| "VIEW_ANALYTICS"
// User Management
| "MANAGE_USERS"
| "VIEW_USERS"
// Campaign Management
| "MANAGE_CAMPAIGNS"
| "CREATE_CAMPAIGN"
| "EDIT_CAMPAIGN"
| "DELETE_CAMPAIGN"
| "VIEW_CAMPAIGNS"
// Deal Management
| "MANAGE_DEALS"
| "CREATE_DEAL"
| "VIEW_DEALS"
| "ACCEPT_DEAL"
| "REJECT_DEAL"
// Application Management
| "MANAGE_APPLICATIONS"
| "APPLY_CAMPAIGN"
| "VIEW_APPLICATIONS"
// Content & Review
| "SUBMIT_CONTENT"
| "REVIEW_CONTENT"
| "APPROVE_CONTENT"
| "REJECT_CONTENT"
// Finance
| "VIEW_OWN_FINANCE"
| "MANAGE_PLATFORM_FINANCE"
| "WITHDRAW_FUNDS"
| "VIEW_TRANSACTIONS"
// Disputes
| "MANAGE_DISPUTES"
| "CREATE_DISPUTE"
| "RESOLVE_DISPUTE"
// Verification & KYC
| "APPROVE_KYC"
| "SUBMIT_VERIFICATION"
| "VIEW_VERIFICATIONS"
// Influencer Management
| "VIEW_INFLUENCERS"
| "MANAGE_INFLUENCERS"
// System Admin
| "SYSTEM_ADMIN"
// Settings
| "MANAGE_SETTINGS"
| "VIEW_SETTINGS";

const ROLE_PERMISSIONS: Record<UserType, Permission[]> = {
ADMIN: [
// Dashboard & Navigation
"VIEW_DASHBOARD",
"VIEW_ANALYTICS",
// User Management
"MANAGE_USERS",
"VIEW_USERS",
// Campaign Management
"MANAGE_CAMPAIGNS",
"EDIT_CAMPAIGN",
"DELETE_CAMPAIGN",
"VIEW_CAMPAIGNS",
// Deal Management
"MANAGE_DEALS",
"VIEW_DEALS",
// Application Management
"MANAGE_APPLICATIONS",
"VIEW_APPLICATIONS",
// Content & Review
"APPROVE_CONTENT",
"REJECT_CONTENT",
// Finance
"VIEW_OWN_FINANCE",
"MANAGE_PLATFORM_FINANCE",
"VIEW_TRANSACTIONS",
// Disputes
"MANAGE_DISPUTES",
"RESOLVE_DISPUTE",
// Verification & KYC
"APPROVE_KYC",
"VIEW_VERIFICATIONS",
// Influencer Management
"VIEW_INFLUENCERS",
"MANAGE_INFLUENCERS",
// System Admin
"SYSTEM_ADMIN",
// Settings
"MANAGE_SETTINGS",
"VIEW_SETTINGS",
],
BRAND: [
// Dashboard & Navigation
"VIEW_DASHBOARD",
"VIEW_ANALYTICS",
// Campaign Management
"MANAGE_CAMPAIGNS",
"CREATE_CAMPAIGN",
"EDIT_CAMPAIGN",
"VIEW_CAMPAIGNS",
// Deal Management
"MANAGE_DEALS",
"CREATE_DEAL",
"VIEW_DEALS",
"ACCEPT_DEAL",
"REJECT_DEAL",
// Application Management
"MANAGE_APPLICATIONS",
"VIEW_APPLICATIONS",
// Content & Review
"REVIEW_CONTENT",
"APPROVE_CONTENT",
"REJECT_CONTENT",
// Finance
"VIEW_OWN_FINANCE",
"VIEW_TRANSACTIONS",
// Disputes
"MANAGE_DISPUTES",
"CREATE_DISPUTE",
// Influencer Management
"VIEW_INFLUENCERS",
// Settings
"VIEW_SETTINGS",
"MANAGE_SETTINGS",
],
INFLUENCER: [
// Dashboard & Navigation
"VIEW_DASHBOARD",
"VIEW_ANALYTICS",
// Campaign Management
"VIEW_CAMPAIGNS",
// Deal Management
"VIEW_DEALS",
"ACCEPT_DEAL",
// Application Management
"APPLY_CAMPAIGN",
"VIEW_APPLICATIONS",
// Content & Review
"SUBMIT_CONTENT",
// Finance
"VIEW_OWN_FINANCE",
"WITHDRAW_FUNDS",
"VIEW_TRANSACTIONS",
// Disputes
"MANAGE_DISPUTES",
"CREATE_DISPUTE",
// Verification & KYC
"SUBMIT_VERIFICATION",
// Settings
"VIEW_SETTINGS",
"MANAGE_SETTINGS",
],
};

type RbacUserType = UserType | string | null | undefined;

export function hasPermission(
userType: RbacUserType,
permission: Permission,
): boolean {
if (!userType) return false;
const permissions = ROLE_PERMISSIONS[userType as UserType];
return permissions?.includes(permission) || false;
}

/**
* Check if user has ANY of the specified permissions
*/
export function hasAnyPermission(
userType: RbacUserType,
permissions: Permission[],
): boolean {
if (!userType) return false;
const userPermissions = ROLE_PERMISSIONS[userType as UserType];
if (!userPermissions) return false;
return permissions.some((perm) => userPermissions.includes(perm));
}

/**
* Check if user has ALL of the specified permissions
*/
export function hasAllPermissions(
userType: RbacUserType,
permissions: Permission[],
): boolean {
if (!userType) return false;
const userPermissions = ROLE_PERMISSIONS[userType as UserType];
if (!userPermissions) return false;
return permissions.every((perm) => userPermissions.includes(perm));
}

/**
* Get all permissions for a given user type
*/
export function getPermissions(userType: RbacUserType): Permission[] {
if (!userType) return [];
return ROLE_PERMISSIONS[userType as UserType] || [];
}

/**
* Check if user is admin
*/
export function isAdmin(userType: RbacUserType): boolean {
return userType === "ADMIN";
}

/**
* Check if user is brand
*/
export function isBrand(userType: RbacUserType): boolean {
return userType === "BRAND";
}

/**
* Check if user is influencer
*/
export function isInfluencer(userType: RbacUserType): boolean {
return userType === "INFLUENCER";
}



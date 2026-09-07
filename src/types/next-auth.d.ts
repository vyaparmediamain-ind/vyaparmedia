import { DefaultSession } from "next-auth";

declare module "next-auth" {
/**
* Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
*/
interface Session {
lastRefreshed?: number;
error?: string;
user: {
id: string;
email: string;
userType: string;
status: string;
verificationLevel: string;
trustScore: number;
xp: number;
level: number;
ip?: string;
} & DefaultSession["user"];
}

interface User {
id: string;
name?: string | null;
email: string | null;
userType?: string;
status?: string;
verificationLevel?: string;
trustScore?: number;
xp?: number;
level?: number;
refreshToken?: string;
}
}

declare module "next-auth/jwt" {
interface JWT {
id?: string;
userType?: string;
status?: string;
verificationLevel?: string;
trustScore?: number;
xp?: number;
level?: number;
lastRefreshed?: number;
error?: string;
refreshToken?: string;
accessTokenExpires?: number;
ip?: string;
ua?: string;
lastCheckedStatus?: number;
}
}

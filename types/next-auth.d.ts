import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    username: string;
    tier: string;
    isAdmin: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      username: string;
      tier: string;
      isAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    tier: string;
    isAdmin: boolean;
  }
}

export interface JwtPayload {
  sub: number;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface UserFromJwt {
  userId: number;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

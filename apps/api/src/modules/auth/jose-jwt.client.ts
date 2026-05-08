import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export class JoseJwtClient {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async signAsync(payload: JWTPayload, opts: { expiresIn: string }): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn)
      .sign(this.key);
  }

  async verifyAsync<T extends JWTPayload>(token: string): Promise<T> {
    const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
    return payload as T;
  }
}

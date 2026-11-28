import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFind: vi.fn(), sessionCreate: vi.fn(), sessionFind: vi.fn(),
  sessionDelete: vi.fn(), sessionDeleteMany: vi.fn(), trustedFind: vi.fn(),
  trustedUpsert: vi.fn(), trustedUpdateMany: vi.fn(), loginEvent: vi.fn(),
  notification: vi.fn(), securityFind: vi.fn(), tokenFind: vi.fn(),
  tokenClaim: vi.fn(), userVerify: vi.fn(), transaction: vi.fn(),
  password: vi.fn(), hashPassword: vi.fn(), device: vi.fn(), pendingSet: vi.fn(),
  pendingRead: vi.fn(), pendingClear: vi.fn(), cookieGet: vi.fn(), cookieSet: vi.fn(),
  csrf: vi.fn(), audit: vi.fn(), totp: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {
  user: { findUnique: mocks.userFind, updateMany: mocks.userVerify },
  session: { create: mocks.sessionCreate, findUnique: mocks.sessionFind,
    delete: mocks.sessionDelete, deleteMany: mocks.sessionDeleteMany },
  trustedDevice: { findUnique: mocks.trustedFind, upsert: mocks.trustedUpsert,
    updateMany: mocks.trustedUpdateMany },
  loginEvent: { create: mocks.loginEvent }, notification: { create: mocks.notification },
  securitySetting: { findUnique: mocks.securityFind },
  verificationToken: { findUnique: mocks.tokenFind, updateMany: mocks.tokenClaim },
  $transaction: mocks.transaction,
} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/password", () => ({ verifyPassword: mocks.password, hashPassword: mocks.hashPassword }));
vi.mock("@/lib/auth/csrf", () => ({ ensureCsrfCookie: mocks.csrf }));
vi.mock("@/lib/auth/device", () => ({ getOrCreateDeviceId: mocks.device, fingerprintDevice: () => "test-device" }));
vi.mock("@/lib/auth/pending-mfa", () => ({ setPendingMfaCookie: mocks.pendingSet,
  readPendingMfaUserId: mocks.pendingRead, clearPendingMfaCookie: mocks.pendingClear }));
vi.mock("@/lib/encryption/aes", () => ({ decryptSecret: () => "test-secret" }));
vi.mock("@/lib/auth/mfa", () => ({ verifyTotpCode: mocks.totp }));
vi.mock("@/lib/audit/log", () => ({ writeAuditLog: mocks.audit }));

import { prisma } from "@/lib/db/prisma";
import { loginUser, verifyMfaAndLogin } from "@/features/authentication/login";
import { verifyEmailToken } from "@/features/authentication/verify-email";
import { createSession, getCurrentUser } from "@/lib/auth/session";
import { getCurrentAdmin } from "@/lib/auth/admin-api";

const user = { id: "user-1", email: "test@example.invalid", passwordHash: "mock-hash",
  role: "USER", status: "ACTIVE", emailVerifiedAt: new Date(),
  securitySetting: { mfaEnabled: false } };
const input = { email: user.email, password: "not-a-real-password", rememberDevice: false };
const mfaInput = { code: "123456", rememberDevice: false };
const token = { id: "token-1", userId: user.id, type: "EMAIL_VERIFICATION",
  consumedAt: null, expiresAt: new Date(Date.now() + 3600000) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userFind.mockResolvedValue(user);
  mocks.password.mockResolvedValue(true);
  mocks.hashPassword.mockResolvedValue("dummy-hash");
  mocks.device.mockResolvedValue({ deviceId: "test-device" });
  mocks.trustedFind.mockResolvedValue(null);
  mocks.pendingRead.mockResolvedValue(user.id);
  mocks.securityFind.mockResolvedValue({ mfaSecretEncrypted: "mock-encrypted" });
  mocks.totp.mockReturnValue(true);
  mocks.cookieGet.mockReturnValue({ value: "mock-session" });
  mocks.sessionFind.mockResolvedValue({ id: "session-1", user, expiresAt: new Date(Date.now() + 60000) });
  mocks.tokenFind.mockResolvedValue(token);
  mocks.tokenClaim.mockResolvedValue({ count: 1 });
  mocks.userVerify.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (work: (tx: typeof prisma) => Promise<void>) => work(prisma));
});

describe("email verification enforcement", () => {
  it("blocks unverified credentials before device or MFA processing", async () => {
    mocks.userFind.mockResolvedValue({ ...user, emailVerifiedAt: null, securitySetting: { mfaEnabled: true } });
    await expect(loginUser(input, {})).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED", status: 403 });
    expect(mocks.device).not.toHaveBeenCalled();
    expect(mocks.pendingSet).not.toHaveBeenCalled();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
  it("does not disclose verification status on incorrect password", async () => {
    mocks.userFind.mockResolvedValue({ ...user, emailVerifiedAt: null });
    mocks.password.mockResolvedValue(false);
    await expect(loginUser(input, {})).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
  });
  it("allows verified credentials to create a session", async () => {
    await expect(loginUser(input, {})).resolves.toEqual({ status: "success" });
    expect(mocks.sessionCreate).toHaveBeenCalledOnce();
    expect(mocks.cookieSet).toHaveBeenCalledOnce();
  });
  it("preserves the MFA challenge for verified users", async () => {
    mocks.userFind.mockResolvedValue({ ...user, securitySetting: { mfaEnabled: true } });
    await expect(loginUser(input, {})).resolves.toEqual({ status: "mfa_required" });
    expect(mocks.pendingSet).toHaveBeenCalledWith(user.id);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it.each(["EMAIL_NOT_VERIFIED", "ACCOUNT_INACTIVE"])("blocks stale MFA challenges: %s", async (code) => {
    mocks.userFind.mockResolvedValue(code === "EMAIL_NOT_VERIFIED" ? { ...user, emailVerifiedAt: null } : { ...user, status: "DEACTIVATED" });
    await expect(verifyMfaAndLogin(mfaInput, {})).rejects.toMatchObject({ code, status: 403 });
    expect(mocks.pendingClear).toHaveBeenCalledOnce();
    expect(mocks.totp).not.toHaveBeenCalled();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it("allows verified MFA completion", async () => {
    await expect(verifyMfaAndLogin(mfaInput, {})).resolves.toBeUndefined();
    expect(mocks.totp).toHaveBeenCalledOnce();
    expect(mocks.sessionCreate).toHaveBeenCalledOnce();
  });
  it("blocks direct session issuance for unverified accounts", async () => {
    mocks.userFind.mockResolvedValue({ ...user, emailVerifiedAt: null });
    await expect(createSession(user.id)).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it("rejects an existing session for an unverified customer", async () => {
    mocks.sessionFind.mockResolvedValue({ user: { ...user, emailVerifiedAt: null }, expiresAt: new Date(Date.now() + 60000) });
    await expect(getCurrentUser()).resolves.toBeNull();
  });
  it("rejects an existing session for an unverified administrator", async () => {
    mocks.sessionFind.mockResolvedValue({ user: { ...user, role: "ADMIN", emailVerifiedAt: null }, expiresAt: new Date(Date.now() + 60000) });
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });
  it("retains access for verified active users", async () => {
    await expect(getCurrentUser()).resolves.toEqual(user);
  });
  it("retains access for verified active administrators", async () => {
    const admin = { ...user, role: "ADMIN" };
    mocks.sessionFind.mockResolvedValue({ user: admin, expiresAt: new Date(Date.now() + 60000) });
    await expect(getCurrentAdmin()).resolves.toEqual(admin);
  });
});

describe("verification token claim", () => {
  it("marks email verified and revokes only that account's legacy sessions and trust", async () => {
    await verifyEmailToken("mock-token");
    expect(mocks.tokenClaim).toHaveBeenCalledWith({ where: { id: token.id, type: "EMAIL_VERIFICATION", consumedAt: null, expiresAt: { gt: expect.any(Date) } }, data: { consumedAt: expect.any(Date) } });
    expect(mocks.userVerify).toHaveBeenCalledWith({ where: { id: user.id, emailVerifiedAt: null }, data: { emailVerifiedAt: expect.any(Date) } });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
    expect(mocks.trustedUpdateMany).toHaveBeenCalledWith({ where: { userId: user.id }, data: { trusted: false } });
  });
  it("does not revoke sessions when the account was already verified", async () => {
    mocks.userVerify.mockResolvedValue({ count: 0 });
    await verifyEmailToken("mock-token");
    expect(mocks.sessionDeleteMany).not.toHaveBeenCalled();
    expect(mocks.trustedUpdateMany).not.toHaveBeenCalled();
  });
  it("rejects consumed tokens", async () => {
    mocks.tokenFind.mockResolvedValue({ ...token, consumedAt: new Date() });
    await expect(verifyEmailToken("mock-token")).rejects.toMatchObject({ code: "TOKEN_ALREADY_USED" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects expired tokens", async () => {
    mocks.tokenFind.mockResolvedValue({ ...token, expiresAt: new Date(0) });
    await expect(verifyEmailToken("mock-token")).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects a lost conditional claim without changing the account", async () => {
    mocks.tokenClaim.mockResolvedValue({ count: 0 });
    await expect(verifyEmailToken("mock-token")).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    expect(mocks.userVerify).not.toHaveBeenCalled();
    expect(mocks.sessionDeleteMany).not.toHaveBeenCalled();
  });
});

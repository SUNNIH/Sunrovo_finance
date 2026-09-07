// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { getCsrfToken } from "@/lib/utilities/api-client";

describe("getCsrfToken", () => {
  beforeEach(() => {
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  });

  it("returns null when the CSRF cookie is absent", () => {
    expect(getCsrfToken()).toBeNull();
  });

  it("reads the CSRF cookie value when present", () => {
    document.cookie = "plt_csrf=abc123";
    expect(getCsrfToken()).toBe("abc123");
  });

  it("decodes a URL-encoded cookie value", () => {
    document.cookie = `plt_csrf=${encodeURIComponent("a+b/c=d")}`;
    expect(getCsrfToken()).toBe("a+b/c=d");
  });

  it("reads the right cookie even when other cookies are present", () => {
    document.cookie = "plt_session=sessiontoken";
    document.cookie = "plt_csrf=thecorrecttoken";
    document.cookie = "plt_device=deviceid";
    expect(getCsrfToken()).toBe("thecorrecttoken");
  });
});

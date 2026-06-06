import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { isPrivateIp } = require("./proxy.js");

describe("isPrivateIp", () => {
  it("flags private and link-local IPv4", () => {
    for (const ip of [
      "0.0.0.0",
      "10.0.0.1",
      "127.0.0.1",
      "169.254.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "100.64.0.1",
      "100.127.255.255",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4, including range boundaries", () => {
    for (const ip of [
      "8.8.8.8",
      "1.1.1.1",
      "172.15.255.255",
      "172.32.0.0",
      "100.63.255.255",
      "100.128.0.0",
      "169.253.0.0",
      "169.255.0.0",
      "11.0.0.1",
      "192.169.0.1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("flags private and link-local IPv6", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12::1", "fe80::1", "feaf::1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("classifies IPv4-mapped IPv6 by the embedded address", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });

  it("returns false for non-IP input", () => {
    expect(isPrivateIp("not-an-ip")).toBe(false);
    expect(isPrivateIp("")).toBe(false);
  });
});

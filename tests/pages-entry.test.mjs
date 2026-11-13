import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet } from "../dist-functions/functions/index.js";

test("Pages root redirects to the login route without caching", async () => {
  const response = await onRequestGet();
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "/login");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
});

test("Pages static output includes noindex and baseline security headers", async () => {
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  assert.match(headers, /X-Robots-Tag:\s*noindex, nofollow/i);
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/i);
  assert.match(headers, /Referrer-Policy:\s*no-referrer/i);
  assert.match(headers, /X-Frame-Options:\s*DENY/i);
});

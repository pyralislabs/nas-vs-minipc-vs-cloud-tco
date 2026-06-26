# Security Policy

## Reporting a Vulnerability

This project takes security and privacy seriously. Please report vulnerabilities
privately by emailing security@minipclab.com.

**Do not file a public issue for security vulnerabilities.**

You should receive a response within 48 hours. If you do not, please follow up.

## Scope

Security-sensitive project properties:

- No backend, telemetry, cookies, local storage, live pricing, remote scripts, or dynamic code
  loading.
- CLI input is untrusted and size-limited before parsing.
- Widget input is untrusted and size-limited before parsing.
- User text (labels, notes) is rendered via text APIs, never HTML interpolation.
- No network calls from the widget at runtime.
- Errors must not expose absolute local paths or stack traces.
- JSON output never contains marketing links or affiliate parameters.
- Input validation rejects unknown fields and unsupported schema versions.

These properties are enforced by tests and CI gates. A vulnerability is any code path that
bypasses these protections, leaks sensitive data, or enables code injection.

## Supported Versions

| Version             | Supported |
| ------------------- | --------- |
| 1.x                 | Yes       |
| < 1.0 (pre-release) | No        |

## Preferred Encryption

PGP key fingerprint: (to be published when v1 is released)

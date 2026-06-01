# Changelog

All notable changes to this URL shortener API are documented here.

This project follows semantic versioning:

- `MAJOR` for breaking API changes.
- `MINOR` for backward-compatible features.
- `PATCH` for backward-compatible fixes.

## [1.6.0]

### Added

- Added API key blacklist middleware backed by `src/config/blacklist.txt`.
- Added request elapsed-time response header support.
- Added internal middleware timing logs.

## [1.5.0]

### Added

- Added request logging middleware.
- Added request logging persistence through the `RequestLogging` table.

### Changed

- Changed request log `timestamp` storage to a database `DateTime`.

## [1.4.0]

### Added

- Added password protection for short codes.
- Added support for editing short code password and expiry date.
- Added user tier support for enterprise-only features.

## [1.3.0]

### Added

- Added user creation with API key generation.
- Added API key authentication middleware for protected endpoints.
- Added user-owned short code listing.
- Added soft delete for users and short codes.

## [1.2.0]

### Added

- Added custom short code support.
- Added support for multiple short codes pointing to the same original URL.

### Changed

- Removed the unique constraint from original URLs.

## [1.1.0]

### Added

- Added URL expiry date support.
- Added analytics collections for shortened URLs.
- Added `/api/v1/health` database connectivity check.

## [1.0.0]

### Added

- Initial URL shortener API.
- Added short URL creation.
- Added redirect by short code.
- Added `/api/v1/ping` server health check.

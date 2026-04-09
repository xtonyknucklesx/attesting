# 5G · Changelog + Semantic Versioning

**Status:** 📋 Planned

## Scope

Establish versioning scheme, changelog, and release process.

## Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`
- Pre-1.0: breaking changes bump MINOR, features bump PATCH
- Post-1.0: standard semver rules
- Version stored in `package.json`

## Changelog

- `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format
- Sections: Added, Changed, Deprecated, Removed, Fixed, Security
- Each release tagged in git

## Release Process

1. Update `CHANGELOG.md` with release notes
2. Bump version in `package.json`
3. `git tag v0.x.0`
4. `git push --tags`
5. GitHub Release with changelog excerpt

## Files to Create

- `CHANGELOG.md` — retroactive entries for current state
- Update `package.json` version field

## Exit Criteria

- [ ] CHANGELOG.md exists with at least the initial release entry
- [ ] Version in package.json matches latest tag
- [ ] Release process documented in CONTRIBUTING.md

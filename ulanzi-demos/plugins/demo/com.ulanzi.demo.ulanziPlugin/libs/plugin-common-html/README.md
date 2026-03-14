# plugin-common-html

This directory must be populated as a git submodule before using the Property
Inspector pages.

```bash
git submodule add https://github.com/UlanziTechnology/plugin-common-html libs/plugin-common-html
git submodule update --init --recursive
```

The library exposes the global `$PI` (Property Inspector API) object used by
all `property-inspector/*/inspector.html` files.

# plugin-common-node

This directory must be populated as a git submodule before running the plugin.

```bash
git submodule add https://github.com/UlanziTechnology/plugin-common-node libs/plugin-common-node
git submodule update --init --recursive
```

The library exposes the global `$UD` (UlanziApi) object used by `plugin/app.js`
and all action files.

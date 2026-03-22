# Plugin Capabilities

SETU Plugin System v1 is a safe extension platform.

## Allowed

- Add plugin menus
- Add plugin pages rendered by host components
- Add plugin widgets rendered in host pages
- Add plugin reports using host-controlled queries
- Add workflow metadata
- Add schema-driven plugin settings
- Add optional approved remote UI pages through `remoteUiPage`

## Not Allowed

- Runtime NestJS module injection
- Runtime TypeORM entity injection
- Arbitrary backend JS/TS execution inside the main process
- Overriding auth guards or permission engine
- Unrestricted filesystem or network execution from plugin bundles

## Safe Runtime Principle

The host owns execution. Plugins declare metadata. The host validates and renders that metadata through approved extension points.

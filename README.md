<section>
  <p align="center">
      <img src="images/ignis.png" alt="Ignis logo" width="200" height="200">
  </p>

  <h3 align="center">Ignis</h3>

  <p align="center">
    Run Obsidian in the browser. No remote desktop required.
  </p>
</section>

## What is this

Ignis is a compatibility shim that provides browser-compatible implementations of the Electron APIs used by Obsidian, allowing Obsidian to run in a standard browser while keeping your vault on the server. Obsidian is not included in or distributed with this project. The Docker container downloads Obsidian directly from its official source on first run.

## Why

While Obsidian's local-first approach works well for most users, options for accessing your own Obsidian installation remotely have been limited to VNC-based solutions with poor user experience. Ignis provides an alternative for users who want to access their own copy of Obsidian from a browser, in a close-to-native format.

## Project Status

Ignis is **experimental**. Core functionality works, and some browser specific enhancements have been added, like file upload and download. Plugin support is an ongoing process of trying out plugins and finding what gaps in the shim still need to be plugged, but if a plugin uses primarily Obsidian's plugin API chances are it will work just fine.

## What works

- Creating, opening, and switching between multiple vaults
- Editing notes (markdown, canvas, bases, all core editor features)
- Community plugins to some degree (anything that doesn't need native Node modules, hopefully).
- File upload and download from the browser
- Live sync of external file changes via WebSocket
- Obsidian Sync has been tested and seems to be working fine, as long as the tab remains open obviously.
- Obsidian Headless has been integrated and can be used for continous synchronization. Can't be used alongside Obsidian Sycn in the browser, you can only pick one sync solution in order to avoid conflicts.

## Plugin Compatibility

Plugin support depends on what APIs a plugin uses. Anything built on Obsidian's plugin API generally works. Plugins that depend on Node.js modules might work depending on which are used.

Compatibility is currently tracked in [Issue #9](https://github.com/Nystik-gh/ignis/issues/9).

## Caveats

_This section will be expanded as issues are documented._

- Community plugins that rely on `child_process` or native Node addons will not work at the moment.
- Mobile browser support is not a priority. It works, but the UX is not great. But I have ideas.
- File picker has a workaround to deal with synchronous file selection issues. Usable, a bit hacky.

## Authentication

Ignis has **no built-in authentication**. The server is completely open by default.

If you are exposing Ignis to the internet, **you should really** put an authentication layer in front of it. Options include:

- A reverse proxy with Basic Auth (nginx, Caddy, Traefik)
- An SSO proxy like Authelia, Authentik, or OAuth2 Proxy
- A VPN (Tailscale, WireGuard)
- Cloudflare Application Tunnel

Example for Basic Auth, and Authelia can be found [here](examples).

> [!CAUTION]
> Do not run Ignis on a public network without auth. Anyone with the url can read and write your vault files.



## Setup with Docker Compose

Ignis is not published to a registry yet. You need to build the image locally.

```bash
git clone https://github.com/Nystik-gh/ignis.git
cd ignis
docker compose up -d
```

On first start, the container will download Obsidian from the official servers and set everything up, and also install Obsidian Headless CLI. This takes a minute or two.

Example `docker-compose.yml`:

```yaml
services:
  ignis:
    build: .
    ports:
      - "8080:8080"
    environment:
      - OBSIDIAN_VERSION=1.12.7
      - PUID=1000
      - PGID=1000
    volumes:
      - ./vaults:/vaults
      - ./data:/app/data
      - obsidian-app:/app/obsidian-app
    restart: unless-stopped

volumes:
  obsidian-app:
```

### Volumes

| Mount | Description |
| ----- | ----------- |
| `/vaults` | Vault storage. Each subdirectory is a vault. |
| `/data` | state persistence for various ignis specific functionality, plugin management, headless sync config, etc |
| `/app/obsidian-app` | Cached Obsidian assets. Persisting this avoids re-downloading on container recreate. |

### Environment Variables

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `PORT` | Server listen port | `8080` |
| `VAULT_ROOT` | Path to vault storage inside the container | `/vaults` |
| `DATA_ROOT` | Path to persistent data (plugin config, sync state, auth tokens) | `/app/data` |
| `OBSIDIAN_VERSION` | Obsidian version to download | `1.12.7` |
| `PUID` | User ID for file ownership | `1000` |
| `PGID` | Group ID for file ownership | `1000` |
| `WRITE_COALESCE_MS` | Debounce window (ms) for rapid writes. Useful for slow filesystems (rclone, NFS, SMB). Set to `0` to disable. | `5000` |
| `DEMO_MODE` | Enable demo mode (per-session vaults, auto-cleanup, proxy allowlist, login blocking). See [examples/demo/](examples/demo/). | `false` |
| `DEMO_MAX_SESSIONS` | Concurrent demo session cap. New visitors get a 503 capacity page when full. | `20` |
| `DEMO_VAULTS_PER_SESSION` | Max vaults per session (vault create returns 507 past this). | `3` |
| `DEMO_SESSION_QUOTA_BYTES` | Cumulative byte budget per session across all session vaults. | `716800` |
| `DEMO_TIMEOUT_MS` | Inactivity timeout before a demo session and its vaults are cleaned up. | `1800000` |
| `DEMO_TEMPLATE_DIR` | Directory copied into each new demo vault. | `server/demo-template/` |

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, especially on how to report plugin compatibility issues. Check the [open issues](https://github.com/Nystik-gh/ignis/issues) for things to work on.

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for details on the shim layer, plugin system, and server internals.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

## Legal Notice

Ignis is not affiliated with, endorsed by, or associated with Dynalist Inc. or Obsidian.

Ignis is an independently developed interoperability tool. It contains no Obsidian source code, binaries, or assets. No part of Obsidian is distributed, bundled, or included in this repository. Ignis serves its own HTML page that loads the shim layer, then dynamically loads Obsidian's unmodified scripts. Obsidian's own files are never altered, patched, or transformed, either on disk or in transit.

Ignis works by providing a compatibility layer that implements browser-compatible equivalents of the Node.js and Electron APIs that Obsidian depends on. The user must obtain their own licensed copy of Obsidian separately. Ignis has no standalone functionality without it.

### Interoperability under EU law

The development of Ignis involved studying Obsidian's module interface layer to understand how it interacts with the Electron and Node.js runtime. This work falls under the interoperability provisions of [Directive 2009/24/EC of the European Parliament and of the Council](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng) (the EU Software Directive), which permits decompilation and analysis of a computer program to achieve interoperability with an independently created program.

Specifically:

- **Article 6(1)** permits reproduction and translation of code where it is indispensable to obtain the information necessary to achieve interoperability of an independently created program with other programs, provided that: (a) the acts are performed by a person having a right to use the program, (b) the interoperability information was not previously readily available, and (c) the acts are confined to the parts necessary to achieve interoperability.
- **Article 5(3)** permits a lawful user to observe, study, and test the functioning of a program to determine the ideas and principles underlying its elements, including its interfaces.
- **Article 8** states that any contractual provisions contrary to Article 6 or the exceptions in Article 5(2) and (3) shall be null and void.

The shim layer targets the runtime interface boundary, the points where Obsidian calls Node.js and Electron APIs, and replaces them with browser-compatible equivalents backed by a server. No Obsidian application logic, algorithms, or non-interface code is reproduced. Ignis also includes a plugin that uses Obsidian's plugin API to add browser-specific functionality such as file upload and download. This plugin interacts with Obsidian in the same manner as any third-party community plugin.

### What Ignis does and does not do

**Does:**
- Provide independently written JavaScript modules that implement Node.js and Electron API surfaces in a browser context
- Provide a server that exposes filesystem operations over HTTP and WebSocket
- Load a shim layer at runtime that intercepts Obsidian's API calls before they reach the (absent) Node.js and Electron environment

**Does not:**
- Distribute, bundle, or include any Obsidian source code, binaries, or assets in this repository. Obsidian is downloaded by the user's own container instance directly from official sources at runtime.
- Modify, patch, or alter any of Obsidian's files on disk
- Reproduce Obsidian's application logic, algorithms, or non-interface code
- Function as a standalone application without Obsidian
- Compete with or replace Obsidian

### Regarding Obsidian's Terms of Service

Obsidian's Terms of Service (Section: Restrictions, item iii) restrict reverse engineering except for the purpose of developing third-party plugins for non-commercial use. To the extent that this restriction conflicts with the rights granted under the EU Software Directive, Article 8 of the Directive renders such contractual provisions null and void.

This project is developed and maintained by an individual based in the European Union, where the Directive applies as implemented in national law.

### Good faith

This project exists because its author uses Obsidian daily and wants to access it from a browser. It is shared in the belief that tools enabling software interoperability benefit users and are protected under EU law. There is no intent to harm Obsidian, Dynalist Inc., or their business. If you are a representative of Dynalist Inc. and wish to discuss this project, please reach out via the contact information provided below.

Email: ignis@thiefling.com
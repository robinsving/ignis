<script>
  import { createEventDispatcher } from "svelte";
  import Banner from "./Banner.svelte";

  const dispatch = createEventDispatcher();
  const origin = window.location.origin;

  function onDismiss() {
    dispatch("dismiss");
  }
</script>

<Banner
  id="ignis-insecure-banner"
  severity="error"
  title="Insecure connection: some features are broken."
  on:dismiss={onDismiss}
>
  <div class="detail">
    This page is served over plain HTTP, so the browser disables several APIs
    (crypto, clipboard, etc) that Obsidian relies on. Several features will not
    work, including graph view, outlines, certain clipboard operations, and
    more.
  </div>
  <div class="fix">
    Fix it by serving Ignis over HTTPS (a TLS reverse proxy or
    <code>tailscale serve</code>). As a local workaround, add this origin to
    <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> and
    relaunch the browser: <code class="origin">{origin}</code>
  </div>
</Banner>

<style>
  .detail {
    margin-top: 0.25rem;
  }

  .fix {
    margin-top: 0.375rem;
  }

  code {
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.3);
    font-family: var(--font-monospace, ui-monospace, monospace);
  }
</style>

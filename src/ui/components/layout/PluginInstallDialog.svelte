<script>
  import { createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";
  import Button from "../input/Button.svelte";
  import { Puzzle, Download, X } from "lucide-svelte";

  export let width = "500px";

  const dispatch = createEventDispatcher();

  let modalRef;
  let installing = false;

  function onInstall() {
    installing = true;
    dispatch("install");
  }

  function onDismiss() {
    modalRef.dismiss();
    dispatch("dismiss");
  }

  function onEscape() {
    onDismiss();
  }

  export function dismiss() {
    modalRef.dismiss();
  }
</script>

<Modal title="Ignis Bridge Plugin" {width} bind:this={modalRef} on:escape={onEscape} closeOnOverlayClick={false}>
  <svelte:fragment slot="icon">
    <Puzzle size="1.25rem" />
  </svelte:fragment>

  <div class="dialog-body">
    <p class="dialog-message">This vault doesn't have the Ignis Bridge plugin installed.</p>
    <p class="dialog-description">
      The plugin adds additional functionality such as file uploads.
      Obsidian will work without it, but some features will be unavailable.
    </p>
  </div>

  <svelte:fragment slot="footer">
    <div class="dialog-footer">
      <Button variant="secondary" on:click={onDismiss}>
        <svelte:fragment slot="icon">
          <X size="0.875rem" />
        </svelte:fragment>
        Not Now
      </Button>
      <Button variant="primary" on:click={onInstall} disabled={installing}>
        <svelte:fragment slot="icon">
          <Download size="0.875rem" />
        </svelte:fragment>
        {installing ? "Installing..." : "Install Plugin"}
      </Button>
    </div>
  </svelte:fragment>
</Modal>

<style>
  .dialog-body {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .dialog-message {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .dialog-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>

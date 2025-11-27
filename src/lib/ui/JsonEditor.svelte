<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { EditorState } from '@codemirror/state';
  import { json } from '@codemirror/lang-json';
  import { oneDark } from '@codemirror/theme-one-dark';

  export let value: string = '';

  let editorContainer: HTMLDivElement;
  let editorView: EditorView | null = null;

  const dispatch = createEventDispatcher();

  onMount(() => {
    const root = editorContainer.getRootNode();

    try {
      const startState = EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          json(),
          oneDark,
          EditorView.lineWrapping,
          // Add padding to the editor content
          EditorView.theme({
            ".cm-content": {
              padding: "10px 0"
            },
            ".cm-line": {
              padding: "0 10px"
            },
            // Ensure gutter doesn't look squashed
            ".cm-gutters": {
              backgroundColor: "var(--pm-input-bg)", // Match input bg
              borderRight: "1px solid var(--pm-border)",
              color: "var(--pm-text-secondary)"
            },
            // Active line highlight
            ".cm-activeLine": {
              backgroundColor: "rgba(255, 255, 255, 0.05)"
            },
            ".cm-activeLineGutter": {
              backgroundColor: "rgba(255, 255, 255, 0.05)"
            }
          }),
          EditorView.updateListener.of((update:any) => {
            if (update.docChanged) {
              dispatch('change', update.state.doc.toString());
            }
          })
        ]
      });

      editorView = new EditorView({
        state: startState,
        parent: editorContainer,
        root: root instanceof ShadowRoot ? root : undefined
      });

    } catch (e) {
      console.error('[JsonEditor] Error loading editor:', e);
    }
  });

  onDestroy(() => {
    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
  });

  // Reactive update when prop 'value' changes externally
  $: if (editorView && value !== editorView.state.doc.toString()) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: value
      }
    });
  }
</script>

<div class="json-editor-container" bind:this={editorContainer}></div>

<style>
  .json-editor-container {
    height: 100%;
    min-height: 200px; /* Increased height */
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--pm-border);
    border-radius: 6px; /* Slightly more rounded */
    transition: border-color 0.2s;
  }
  
  /* Focus state for container */
  .json-editor-container:focus-within {
    border-color: var(--pm-primary);
    box-shadow: 0 0 0 1px var(--pm-primary);
  }

  /* Override CodeMirror's default background to match theme */
  :global(.cm-editor) {
    height: 100%;
    background-color: var(--pm-input-bg) !important;
    font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace !important;
    font-size: 13px !important; /* Slightly larger font */
    line-height: 1.6 !important; /* Better line height */
  }
  
  /* Remove default outline from CodeMirror when focused (handled by container) */
  :global(.cm-editor.cm-focused) {
    outline: none !important;
  }

  /* Adjust CodeMirror scroll bars */
  :global(.cm-scroller) {
    overflow: auto;
  }

  /* Custom Dark Scrollbar for CodeMirror */
  :global(.cm-scroller::-webkit-scrollbar) {
    width: 10px;
    height: 10px;
  }
  :global(.cm-scroller::-webkit-scrollbar-track) {
    background: transparent;
  }
  :global(.cm-scroller::-webkit-scrollbar-thumb) {
    background: #444;
    border-radius: 5px;
    border: 2px solid var(--pm-input-bg);
  }
  :global(.cm-scroller::-webkit-scrollbar-thumb:hover) {
    background: #555;
  }
  :global(.cm-scroller::-webkit-scrollbar-corner) {
    background: transparent;
  }
</style>
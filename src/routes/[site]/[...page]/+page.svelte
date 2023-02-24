<script>
  import Page from '@primo-app/primo/views/editor/Page.svelte'
  import { page } from '$app/stores'
</script>

<Page id={$page.params.page} />

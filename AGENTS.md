<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- File content is extracted in the browser (`src/lib/extract.ts`) and sent to `ingestDocument`; server functions never parse binaries (worker runtime).
- Retrieval uses Postgres full-text search (`search_chunks` RPC, security invoker) so every answer is traceable to stored chunks with page/slide/timestamp.
- All AI calls go through `src/lib/ai/gateway.server.ts` (streamed Responses API); the tutor streams from the `/api/tutor` server route, which verifies the bearer token itself.
- Mastery logic lives only in `src/lib/mastery.ts` (BKT) and is covered by `src/test/mastery.test.ts`; never duplicate the formula elsewhere.
- tsconfig keeps `strict` but disables exactOptionalPropertyTypes/noUncheckedIndexedAccess/noPropertyAccessFromIndexSignature/noImplicitReturns — generated UI kits and Supabase types conflict with them.
- vite.config.ts defines public VITE_SUPABASE_* fallbacks so publish builds connect even when .env is absent.

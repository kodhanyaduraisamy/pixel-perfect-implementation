
create policy "own materials read" on storage.objects for select to authenticated using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own materials insert" on storage.objects for insert to authenticated with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own materials delete" on storage.objects for delete to authenticated using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

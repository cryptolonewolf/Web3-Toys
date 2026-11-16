-- web3.toys: the books are not written yet, so they cannot be unlocked
-- with coins (the checkout already ignores them: data/products.json,
-- notForSale). Paste into Supabase: SQL Editor, New query, Run. Safe to run
-- again. When a book is ready, add it back in 008_quests_referrals.sql and
-- run that file.
delete from public.coin_products where id in ('book-first-30-days', 'book-dont-get-rekt', 'book-launch-week');

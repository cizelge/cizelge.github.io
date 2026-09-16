-- Hocaya ait iki soru (anlatım, notlandırma). Var olan veritabanına eklemek için:
--   npx wrangler d1 execute cizelge-oy --remote --file=schema-2.sql
ALTER TABLE votes ADD COLUMN clarity INTEGER;
ALTER TABLE votes ADD COLUMN fairness INTEGER;

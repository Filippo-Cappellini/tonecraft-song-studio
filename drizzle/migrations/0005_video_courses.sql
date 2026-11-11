-- Video corsi consigliati per ogni strumento (link esterni a canali e siti verificati).
CREATE TABLE IF NOT EXISTS public.courses (
  id text PRIMARY KEY,
  instrument_id text NOT NULL REFERENCES public.instruments(id),
  title text NOT NULL,
  teacher text NOT NULL,
  description text NOT NULL,
  url text NOT NULL,
  language text NOT NULL DEFAULT 'Inglese',
  level int NOT NULL DEFAULT 1,
  free boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.courses;
CREATE POLICY "public read" ON public.courses FOR SELECT USING (true);

INSERT INTO public.courses VALUES
('c-justinguitar','chitarra','Corso per principianti','JustinGuitar','Il corso gratuito più seguito al mondo: dai primi accordi al primo brano, una lezione alla volta.','https://www.youtube.com/@JustinGuitar','Inglese (sottotitoli)',1,true,1),
('c-marty','chitarra','Impara i brani famosi','Marty Music','Lezioni chiare su riff e canzoni rock, nota per nota.','https://www.youtube.com/@MartyMusic','Inglese',2,true,2),
('c-chitarra-it','chitarra','Lezioni di chitarra in italiano','YouTube','Una selezione di lezioni per principianti in italiano.','https://www.youtube.com/results?search_query=lezioni+di+chitarra+per+principianti','Italiano',1,true,3),
('c-bassbuzz','basso','Basso per principianti','BassBuzz','Lezioni brevi e divertenti per iniziare: postura, prime linee e groove.','https://www.youtube.com/@BassBuzz','Inglese',1,true,1),
('c-sbl','basso','Tecnica e groove','Scott''s Bass Lessons','Scott Devine spiega tecnica, slap, teoria e groove per tutti i livelli.','https://www.youtube.com/@scottsbasslessons','Inglese',2,true,2),
('c-basso-it','basso','Lezioni di basso in italiano','YouTube','Una selezione di lezioni per principianti in italiano.','https://www.youtube.com/results?search_query=lezioni+di+basso+per+principianti','Italiano',1,true,3),
('c-pianote','pianoforte','Pianoforte passo dopo passo','Pianote','Lezioni gratuite sul sito, con un corso completo a pagamento per chi vuole andare avanti.','https://www.pianote.com/','Inglese',1,false,1),
('c-piano-it','pianoforte','Lezioni di pianoforte in italiano','YouTube','Una selezione di lezioni per principianti in italiano.','https://www.youtube.com/results?search_query=lezioni+di+pianoforte+per+principianti','Italiano',1,true,2),
('c-drumeo','batteria','Batteria per tutti i livelli','Drumeo','Lezioni gratuite dei migliori batteristi, con un corso completo a pagamento.','https://www.drumeo.com/','Inglese',1,false,1),
('c-batteria-it','batteria','Lezioni di batteria in italiano','YouTube','Una selezione di lezioni per principianti in italiano.','https://www.youtube.com/results?search_query=lezioni+di+batteria+per+principianti','Italiano',1,true,2)
ON CONFLICT (id) DO NOTHING;

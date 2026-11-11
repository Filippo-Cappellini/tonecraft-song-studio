-- Curiosità sui grandi della storia della musica, mostrate nello Studio.
CREATE TABLE IF NOT EXISTS public.legends (
  id text PRIMARY KEY,
  person text NOT NULL,
  role text NOT NULL,
  title text NOT NULL,
  fact text NOT NULL,
  year int,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.legends TO anon, authenticated;
GRANT ALL ON public.legends TO service_role;
ALTER TABLE public.legends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.legends;
CREATE POLICY "public read" ON public.legends FOR SELECT USING (true);

INSERT INTO public.legends VALUES
('hendrix-strat','Jimi Hendrix','Chitarra','La Stratocaster al contrario','Hendrix era mancino ma suonava quasi sempre Stratocaster per destri, capovolte e con le corde montate al contrario. Per questo i suoi pickup avevano un suono diverso da quello di tutti gli altri.',1967,1),
('django-two-fingers','Django Reinhardt','Chitarra','Un genio con due dita','Nel 1928 un incendio nella sua roulotte gli danneggiò la mano sinistra: anulare e mignolo rimasero quasi paralizzati. Django inventò una tecnica nuova e suonò gli assoli più veloci del jazz usando soprattutto indice e medio.',1928,2),
('iommi-thimbles','Tony Iommi','Chitarra','I ditali che hanno inventato il metal','A 17 anni, nell''ultimo giorno di lavoro in fabbrica, una pressa gli tranciò le punte di due dita. Si costruì dei ditali di plastica e usò corde più morbide e accordature più basse: è anche così che nacque il suono cupo dei Black Sabbath.',1965,3),
('may-red-special','Brian May','Chitarra','La chitarra fatta in casa','La Red Special, la chitarra di tutti i dischi dei Queen, l''ha costruita da ragazzo insieme al padre, usando anche il legno di un vecchio camino. Come plettro usa una moneta da sei pence.',1963,4),
('bbking-lucille','B.B. King','Chitarra','Perché si chiamava Lucille','Nel 1949, durante un concerto, due uomini litigarono per una donna di nome Lucille e fecero scoppiare un incendio. B.B. King rientrò nel locale in fiamme per salvare la sua chitarra: da allora chiamò Lucille tutte le sue chitarre, per ricordarsi di non rifarlo.',1949,5),
('evh-frankenstrat','Eddie Van Halen','Chitarra','La Frankenstrat','Eddie si costruì la sua chitarra con pezzi di modelli diversi e la dipinse a strisce usando il nastro adesivo. La chiamò Frankenstrat, come il mostro di Frankenstein.',1977,6),
('keith-satisfaction','Keith Richards','Chitarra','Il riff arrivato in sogno','Il riff di "(I Can''t Get No) Satisfaction" gli venne in mente di notte: lo registrò su un registratore a cassette vicino al letto e si riaddormentò. Al mattino trovò il riff e poi una quarantina di minuti di russare.',1965,7),
('les-paul-log','Les Paul','Chitarra','"The Log", il tronco che suonava','Negli anni ''40 Les Paul costruì "The Log": un blocco di legno pieno con i pickup sopra, uno dei primi esperimenti di chitarra elettrica solid body. Fu anche un pioniere della registrazione multitraccia.',1941,8),
('chuck-duckwalk','Chuck Berry','Chitarra','Il "duck walk"','Chuck Berry rese famosa la camminata "a papera": saltellare su una gamba sola, piegato, continuando a suonare. Ha ispirato generazioni di chitarristi rock sul palco.',1956,9),
('jaco-fretless','Jaco Pastorius','Basso','Il fretless fatto da sé','Jaco tolse i tasti al suo Fender Jazz Bass, riempì le fessure con stucco per legno e ricoprì la tastiera di resina. Il suono "cantato" di quel basso ha cambiato la storia del basso elettrico.',1970,10),
('mccartney-hofner','Paul McCartney','Basso','Il basso a violino','Paul è mancino e scelse il Höfner a violino anche perché, essendo simmetrico, non sembrava strano suonarlo al contrario. Ed era uno dei bassi più economici che potesse permettersi ad Amburgo.',1961,11),
('beethoven-ninth','Ludwig van Beethoven','Pianoforte','La Nona scritta da sordo','Quando compose la Nona Sinfonia, Beethoven era ormai quasi completamente sordo. Alla prima esecuzione, nel 1824, si dovette girare verso il pubblico per vedere gli applausi che non poteva sentire.',1824,12),
('mozart-five','Wolfgang Amadeus Mozart','Pianoforte','Compositore a cinque anni','Mozart scrisse le sue prime piccole composizioni per tastiera a cinque anni e a sei suonava già nelle corti d''Europa insieme alla sorella Nannerl.',1761,13),
('gould-chair','Glenn Gould','Pianoforte','La sedia del papà','Il pianista canadese suonava seduto su una sedia molto bassa costruita dal padre. La usò per tutta la carriera, anche quando ormai era tutta rovinata.',1955,14),
('stevie-motown','Stevie Wonder','Pianoforte','Un contratto a 11 anni','Stevie Wonder firmò con la Motown a soli 11 anni. Suonava già pianoforte, armonica e batteria.',1961,15),
('bonham-hands','John Bonham','Batteria','L''assolo a mani nude','Durante l''assolo di "Moby Dick" dei Led Zeppelin, dal vivo Bonham a volte posava le bacchette e suonava i tamburi con le mani.',1969,16),
('peart-professor','Neil Peart','Batteria','"Il Professore"','Il batterista dei Rush era soprannominato "The Professor" per la precisione e per i testi colti che scriveva per la band. Continuò a prendere lezioni anche da famoso.',1974,17),
('cobain-teen-spirit','Kurt Cobain','Voce e chitarra','Il deodorante dietro "Teen Spirit"','Un''amica scrisse su un muro "Kurt smells like Teen Spirit". Kurt la prese come una frase ribelle: solo dopo scoprì che Teen Spirit era una marca di deodorante.',1991,18),
('morricone-scores','Ennio Morricone','Compositore','Oltre 400 colonne sonore','Il compositore romano ha scritto musica per più di 400 film e serie. Dopo l''Oscar alla carriera nel 2007, ne vinse uno anche per "The Hateful Eight" nel 2016.',2016,19),
('queen-bohemian','Queen','Band','Le voci di Bohemian Rhapsody','Per la parte operistica di "Bohemian Rhapsody" i Queen sovrapposero le loro voci tantissime volte, fino a consumare il nastro: si parla di circa 180 sovraincisioni.',1975,20)
ON CONFLICT (id) DO NOTHING;

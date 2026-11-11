CREATE TABLE public.instruments (id text PRIMARY KEY, name text NOT NULL, tagline text NOT NULL, has_amp boolean NOT NULL DEFAULT true, sort int NOT NULL DEFAULT 0);
CREATE TABLE public.brands (id text PRIMARY KEY, instrument_id text NOT NULL REFERENCES public.instruments(id), name text NOT NULL, country text NOT NULL, founded int, description text NOT NULL, sort int NOT NULL DEFAULT 0);
CREATE TABLE public.models (id text PRIMARY KEY, brand_id text NOT NULL REFERENCES public.brands(id), name text NOT NULL, shape text NOT NULL, color text NOT NULL, finish text NOT NULL DEFAULT 'solid', pickguard text, hardware text NOT NULL DEFAULT 'chrome', pickups text NOT NULL, description text NOT NULL, price_eur int NOT NULL, sort int NOT NULL DEFAULT 0);
CREATE TABLE public.amps (id text PRIMARY KEY, instrument_id text NOT NULL REFERENCES public.instruments(id), brand text NOT NULL, name text NOT NULL, kind text NOT NULL, watts int NOT NULL, description text NOT NULL, sort int NOT NULL DEFAULT 0);
CREATE TABLE public.songs (id text PRIMARY KEY, instrument_id text NOT NULL REFERENCES public.instruments(id), title text NOT NULL, artist text NOT NULL, album text NOT NULL, year int NOT NULL, genre text NOT NULL, difficulty int NOT NULL, bpm int NOT NULL, song_key text NOT NULL, tuning text NOT NULL DEFAULT 'Standard (EADGBE)', notation text);
CREATE TABLE public.tones (song_id text PRIMARY KEY REFERENCES public.songs(id), amp text NOT NULL, pickup text NOT NULL, gain int NOT NULL, bass int NOT NULL, mid int NOT NULL, treble int NOT NULL, presence int NOT NULL, reverb int NOT NULL, effects text NOT NULL, notes text NOT NULL);
CREATE TABLE public.exercises (id text PRIMARY KEY, instrument_id text NOT NULL REFERENCES public.instruments(id), title text NOT NULL, category text NOT NULL, level int NOT NULL, minutes int NOT NULL, bpm int NOT NULL, description text NOT NULL, steps text NOT NULL, notation text);
CREATE TABLE public.scores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), song_id text NOT NULL REFERENCES public.songs(id), player text NOT NULL DEFAULT 'Anonimo', score int NOT NULL, accuracy int NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT ON public.instruments, public.brands, public.models, public.amps, public.songs, public.tones, public.exercises TO anon, authenticated;
GRANT SELECT, INSERT ON public.scores TO anon, authenticated;
GRANT ALL ON public.instruments, public.brands, public.models, public.amps, public.songs, public.tones, public.exercises, public.scores TO service_role;

ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.instruments FOR SELECT USING (true);
CREATE POLICY "public read" ON public.brands FOR SELECT USING (true);
CREATE POLICY "public read" ON public.models FOR SELECT USING (true);
CREATE POLICY "public read" ON public.amps FOR SELECT USING (true);
CREATE POLICY "public read" ON public.songs FOR SELECT USING (true);
CREATE POLICY "public read" ON public.tones FOR SELECT USING (true);
CREATE POLICY "public read" ON public.exercises FOR SELECT USING (true);
CREATE POLICY "public read" ON public.scores FOR SELECT USING (true);
CREATE POLICY "public insert valid" ON public.scores FOR INSERT WITH CHECK (score >= 0 AND score <= 1000000 AND accuracy BETWEEN 0 AND 100 AND char_length(player) BETWEEN 1 AND 24);

INSERT INTO public.instruments VALUES
('chitarra','Chitarra elettrica','Dal blues al metal. Sei corde, infinite possibilità.',true,1),
('basso','Basso elettrico','Il groove che tiene insieme tutta la band.',true,2),
('pianoforte','Pianoforte','Ottantotto tasti, dalla classica al pop.',false,3),
('batteria','Batteria','Il cuore ritmico di ogni brano.',false,4);

INSERT INTO public.brands VALUES
('esp','chitarra','ESP','Giappone',1975,'Strumenti da palco per il metal moderno. Le signature di James Hetfield e Kirk Hammett hanno fatto la storia.',1),
('ibanez','chitarra','Ibanez','Giappone',1957,'Manici sottili e veloci, ponti Edge. La scelta di Steve Vai, Joe Satriani e dello shred.',2),
('gibson','chitarra','Gibson','USA',1902,'Mogano, humbucker e sustain infinito. Les Paul, SG ed Explorer sono icone del rock.',3),
('fender','chitarra','Fender','USA',1946,'Le prime solid body di serie. Stratocaster e Telecaster: brillanti, articolate, senza tempo.',4),
('fender-bass','basso','Fender','USA',1946,'Precision e Jazz Bass: i due bassi più registrati della storia.',1),
('ibanez-bass','basso','Ibanez','Giappone',1957,'Serie SR: corpo leggero, manico sottile, elettronica attiva.',2),
('gibson-bass','basso','Gibson','USA',1902,'Il Thunderbird: forma neck-through e suono grosso.',3),
('steinway','pianoforte','Steinway & Sons','USA / Germania',1853,'Il riferimento delle sale da concerto di tutto il mondo.',1),
('yamaha','pianoforte','Yamaha','Giappone',1887,'Dai gran coda C-series ai digitali da palco CP.',2),
('nord','pianoforte','Nord','Svezia',1983,'Stage piano rossi, leggeri e pensati per il live.',3),
('pearl','batteria','Pearl','Giappone',1946,'Fusti Masters in acero: caldi e potenti.',1),
('tama','batteria','Tama','Giappone',1974,'Starclassic: la batteria di Lars Ulrich e di molti session man.',2),
('dw','batteria','DW','USA',1972,'Collector''s Series, fusti custom fatti a mano in California.',3);

INSERT INTO public.models VALUES
('esp-snakebyte','esp','Snakebyte (James Hetfield)','snakebyte','#0d0d0d','solid',NULL,'black','EMG Het Set (attivi)','Derivata dall''Explorer con la punta a "morso di serpente". Mogano, manico set-in, intarsi a croce di ferro.',3299,1),
('esp-eclipse','esp','Eclipse II','lespaul','#111111','solid',NULL,'chrome','EMG 81 / 60','Single cut in mogano con top in acero. Una Les Paul con manico più veloce.',1499,2),
('esp-mii','esp','M-II Neck Thru','superstrat','#1f3b73','metallic',NULL,'black','Seymour Duncan JB / Floyd Rose','Superstrat anni ''80 con ponte Floyd Rose e una sola humbucker.',2199,3),
('esp-kh2','esp','KH-2 (Kirk Hammett)','superstrat','#0b0b0b','solid',NULL,'chrome','EMG 81 / 60, Floyd Rose','La superstrat di Kirk Hammett, nera con grafica minimale.',2899,4),
('ibanez-rg550','ibanez','RG550 Genesis','superstrat','#e8d33a','solid',NULL,'chrome','V7 / S1 / V8, Edge','Il Desert Sun Yellow anni ''87. Manico Super Wizard e ponte Edge.',1199,1),
('ibanez-jem','ibanez','JEM7V (Steve Vai)','jem','#f2f2f2','solid',NULL,'gold','DiMarzio Evolution HSH','Bianca con hardware oro e la maniglia "monkey grip". Tastiera con intarsi a vite.',3999,2),
('ibanez-iceman','ibanez','Iceman IC420','iceman','#7a0b0b','metallic',NULL,'chrome','Humbucker x2','Forma asimmetrica anni ''70 resa famosa da Paul Stanley.',799,3),
('ibanez-az','ibanez','AZ2402 Prestige','strat','#c9a46a','natural',NULL,'chrome','Seymour Duncan Hyperion','Moderna, versatile, manico in acero roasted.',2499,4),
('gibson-lp','gibson','Les Paul Standard ''50s','lespaul','#c06a1e','sunburst',NULL,'gold','Burstbucker 61R / 61T','Mogano con top in acero fiammato Heritage Cherry Sunburst. La chitarra di Slash e Jimmy Page.',2899,1),
('gibson-sg','gibson','SG Standard','sg','#7a1414','solid','#111111','chrome','490R / 490T','Doppia spalla mancante e corpo sottile. Angus Young, Tony Iommi.',1799,2),
('gibson-explorer','gibson','Explorer','explorer','#efe9dc','solid','#111111','chrome','490R / 498T','Forma futuristica del 1958, cuore del metal di Hetfield anni ''80.',1999,3),
('gibson-flyingv','gibson','Flying V','flyingv','#0d0d0d','solid','#f2f2f2','chrome','490R / 498T','La V di Hendrix e Kirk Hammett, mogano leggero.',1999,4),
('fender-strat','fender','American Professional II Stratocaster','strat','#c75b12','sunburst','#f4efe4','chrome','V-Mod II single coil x3','Tre single coil, ponte tremolo e contour. Hendrix, Gilmour, Knopfler.',1999,1),
('fender-tele','fender','Player Telecaster','tele','#e6d3a3','solid','#111111','chrome','Alnico V single coil x2','Il twang del country e del rock: semplice e tagliente.',849,2),
('fender-strat-black','fender','Eric Clapton Stratocaster','strat','#0d0d0d','solid','#f4efe4','chrome','Vintage Noiseless x3','La "Blackie" moderna con mid boost attivo.',2299,3),
('fender-jazzmaster','fender','American Vintage II Jazzmaster','strat','#5d8c7b','solid','#6b3d1c','chrome','Jazzmaster single coil x2','Offset dalla voce morbida, amata dall''indie e dallo shoegaze.',2499,4),
('fender-pbass','fender-bass','Precision Bass','pbass','#c75b12','sunburst','#3b1f12','chrome','Split single coil','Un pickup, un suono: quello di James Jamerson e Sting.',1799,1),
('fender-jbass','fender-bass','Jazz Bass','jbass','#4b5d3a','solid','#3b1f12','chrome','Single coil x2','Manico stretto e due pickup: Jaco Pastorius, Flea, Marcus Miller.',1899,2),
('ibanez-sr','ibanez-bass','SR500E','jbass','#3a2416','natural',NULL,'black','Bartolini MK-1, EQ attivo','Leggero e moderno, ideale per slap e fusion.',899,1),
('gibson-tbird','gibson-bass','Thunderbird IV','tbird','#c06a1e','sunburst','#f2f2f2','chrome','Thunderbird humbucker x2','Neck-through dal 1963: grosso, ringhioso.',2199,1),
('steinway-d','steinway','Model D Concert Grand','grand','#0a0a0a','gloss',NULL,'gold','—','274 cm di gran coda: lo standard dei concertisti.',190000,1),
('steinway-k','steinway','Model K-132 Upright','upright','#0a0a0a','gloss',NULL,'gold','—','Il verticale più grande di Steinway.',42000,2),
('yamaha-c3x','yamaha','C3X Grand','grand','#0a0a0a','gloss',NULL,'gold','—','Gran coda da 186 cm, voce chiara e brillante.',38000,1),
('yamaha-u1','yamaha','U1 Upright','upright','#2a1a10','gloss',NULL,'gold','—','Il verticale più diffuso nelle scuole di musica.',8900,2),
('yamaha-cp88','yamaha','CP88 Stage Piano','stage','#1a1a1a','matte',NULL,'chrome','—','88 tasti a martelletto in legno, pensato per il live.',2399,3),
('nord-stage4','nord','Stage 4 88','stage','#c8102e','matte',NULL,'chrome','—','Il rosso Nord: piano, organo e synth in un solo strumento.',4999,1),
('pearl-masters','pearl','Masters Maple Complete','kit','#7a3b1a','sunburst',NULL,'chrome','—','Fusti in acero a 4 strati, Tobacco Burst.',3499,1),
('tama-starclassic','tama','Starclassic Maple','kit','#0d0d0d','gloss',NULL,'black','—','Piano Black con hardware nero: il set di molti tour metal.',3999,1),
('dw-collectors','dw','Collector''s Series','kit','#7a1414','gloss',NULL,'chrome','—','Candy Red, fusti custom fatti a mano.',6999,1);

INSERT INTO public.amps VALUES
('marshall-jcm800','chitarra','Marshall','JCM800 2203','Valvolare',100,'Il crunch del rock anni ''80. AC/DC, Slayer, Zakk Wylde.',1),
('marshall-plexi','chitarra','Marshall','1959 Super Lead "Plexi"','Valvolare',100,'Hendrix, Led Zeppelin, Van Halen: il suono classico britannico.',2),
('mesa-rectifier','chitarra','Mesa/Boogie','Dual Rectifier','Valvolare',100,'Alta saturazione e basse profonde: Metallica dal Black Album in poi.',3),
('mesa-mk','chitarra','Mesa/Boogie','Mark IIC+','Valvolare',60,'Il suono di Master of Puppets e di John Petrucci.',4),
('fender-twin','chitarra','Fender','Twin Reverb ''65','Valvolare',85,'Pulito cristallino con riverbero a molla.',5),
('vox-ac30','chitarra','Vox','AC30','Valvolare',30,'Chime britannico: Beatles, Queen, The Edge.',6),
('peavey-5150','chitarra','Peavey','5150','Valvolare',120,'Il mostro di Van Halen, standard del metal moderno.',7),
('orange-rockerverb','chitarra','Orange','Rockerverb 50 MKIII','Valvolare',50,'Grasso, ricco di medie, stoner e alternative.',8),
('boss-katana','chitarra','Boss','Katana 100 MkII','Transistor / modeling',100,'Versatile, ottimo per studiare a casa.',9),
('ampeg-svt','basso','Ampeg','SVT Classic','Valvolare',300,'Il suono rock del basso per eccellenza.',1),
('fender-bassman','basso','Fender','Bassman 800','Ibrido',800,'Pulito, profondo e leggero da trasportare.',2),
('darkglass','basso','Darkglass','Microtubes 900','Digitale / Class D',900,'Distorsione moderna per metal e prog.',3);

INSERT INTO public.songs VALUES
('enter-sandman','chitarra','Enter Sandman','Metallica','Metallica',1991,'Metal',2,123,'E minore','Standard (EADGBE)',E'e|------------------------------------|\nB|------------------------------------|\nG|------------------------------------|\nD|------------------------------------|\nA|-----7-------6-----5-------6--------|\nE|-0------6-5-------------7----0------|'),
('master-of-puppets','chitarra','Master of Puppets','Metallica','Master of Puppets',1986,'Metal',4,212,'E minore','Standard (EADGBE)',E'e|------------------------------------|\nB|------------------------------------|\nG|------------------------------------|\nD|------------------------------------|\nA|--------------------7-------6-------|\nE|-0-0-0-0-0-0-8-7-6--0-0-0--0-0-5----|'),
('nothing-else-matters','chitarra','Nothing Else Matters','Metallica','Metallica',1991,'Metal',2,69,'E minore','Standard (EADGBE)',E'e|-0-----------0-----------0---------|\nB|-----0-----------0-----------0-----|\nG|---0---0-------0---0-------0---0---|\nD|-----------------------------------|\nA|-----------------------------------|\nE|-0-----------0-----------0---------|'),
('smoke-on-the-water','chitarra','Smoke on the Water','Deep Purple','Machine Head',1972,'Hard Rock',1,112,'G minore','Standard (EADGBE)',E'e|---------------------------------|\nB|---------------------------------|\nG|-0--3--5----0--3--6-5----0--3--5-|\nD|-0--3--5----0--3--6-5----0--3--5-|\nA|---------------------------------|\nE|---------------------------------|'),
('back-in-black','chitarra','Back in Black','AC/DC','Back in Black',1980,'Hard Rock',2,94,'E maggiore','Standard (EADGBE)',E'e|------------------------------------|\nB|-------------------3--3--3---------|\nG|-------2--2--2-----4--4--4---------|\nD|-2-----2--2--2-----5--5--5---------|\nA|-2-----0--0--0-----5--5--5---------|\nE|-0---------------------------------|'),
('highway-to-hell','chitarra','Highway to Hell','AC/DC','Highway to Hell',1979,'Hard Rock',1,116,'A maggiore','Standard (EADGBE)',NULL),
('thunderstruck','chitarra','Thunderstruck','AC/DC','The Razors Edge',1990,'Hard Rock',4,134,'B minore','Standard (EADGBE)',E'e|------------------------------------|\nB|-0-4-0-2-0-5-0-2-0-4-0-2-0-5-0-2---|\nG|------------------------------------|\nD|------------------------------------|\nA|------------------------------------|\nE|------------------------------------|'),
('sweet-child','chitarra','Sweet Child O'' Mine','Guns N'' Roses','Appetite for Destruction',1987,'Hard Rock',3,125,'D maggiore','Mezzo tono sotto (Eb)',E'e|-----------15------14------|\nB|-15----13------15------15-|\nG|----14------14------14----|\nD|-12-----------------------|\nA|--------------------------|\nE|--------------------------|'),
('paranoid','chitarra','Paranoid','Black Sabbath','Paranoid',1970,'Metal',2,163,'E minore','Standard (EADGBE)',NULL),
('iron-man','chitarra','Iron Man','Black Sabbath','Paranoid',1970,'Metal',2,76,'B minore','Standard (EADGBE)',E'e|-----------------------------|\nB|-----------------------------|\nG|-----------------------------|\nD|------5-5-7-7----------------|\nA|-5-7-------------10-9-10-9-7-|\nE|-----------------------------|'),
('seven-nation-army','chitarra','Seven Nation Army','The White Stripes','Elephant',2003,'Alternative',1,124,'E minore','Standard (EADGBE)',E'e|---------------------|\nB|---------------------|\nG|---------------------|\nD|---------------------|\nA|-7--7-10-7-5-3-2-----|\nE|---------------------|'),
('teen-spirit','chitarra','Smells Like Teen Spirit','Nirvana','Nevermind',1991,'Grunge',2,117,'F minore','Standard (EADGBE)',NULL),
('come-as-you-are','chitarra','Come As You Are','Nirvana','Nevermind',1991,'Grunge',1,120,'E minore','Un tono sotto (D)',E'e|---------------------------------|\nB|---------------------------------|\nG|---------------------------------|\nD|---------------------------------|\nA|-------0-0----2-----2--0---------|\nE|-0-0-1-----2-----2-----------0-1-|'),
('stairway','chitarra','Stairway to Heaven','Led Zeppelin','Led Zeppelin IV',1971,'Classic Rock',3,72,'A minore','Standard (EADGBE)',E'e|-------5-7-----7-8-----8-2-----2-0---|\nB|-----5-----5-------5-------3-----1---|\nG|---5---------5-------5-------2-------|\nD|-7-------6-------5-------4-----------|\nA|-------------------------------------|\nE|-------------------------------------|'),
('whole-lotta-love','chitarra','Whole Lotta Love','Led Zeppelin','Led Zeppelin II',1969,'Classic Rock',2,90,'E maggiore','Standard (EADGBE)',NULL),
('hotel-california','chitarra','Hotel California','Eagles','Hotel California',1976,'Classic Rock',4,74,'B minore','Standard (EADGBE)',NULL),
('comfortably-numb','chitarra','Comfortably Numb','Pink Floyd','The Wall',1979,'Progressive',4,64,'B minore','Standard (EADGBE)',NULL),
('wish-you-were-here','chitarra','Wish You Were Here','Pink Floyd','Wish You Were Here',1975,'Progressive',2,60,'G maggiore','Standard (EADGBE)',NULL),
('purple-haze','chitarra','Purple Haze','Jimi Hendrix','Are You Experienced',1967,'Classic Rock',3,108,'E minore','Mezzo tono sotto (Eb)',NULL),
('sunshine','chitarra','Sunshine of Your Love','Cream','Disraeli Gears',1967,'Classic Rock',2,116,'D minore','Standard (EADGBE)',E'e|----------------------------|\nB|----------------------------|\nG|----------------------------|\nD|-12-12-10-12-------------12-|\nA|-------------11-10-9--------|\nE|----------------------10----|'),
('johnny-b-goode','chitarra','Johnny B. Goode','Chuck Berry','Chuck Berry Is on Top',1958,'Rock''n''Roll',3,168,'B maggiore','Standard (EADGBE)',NULL),
('layla','chitarra','Layla','Derek and the Dominos','Layla and Other Assorted Love Songs',1970,'Classic Rock',3,116,'D minore','Standard (EADGBE)',NULL),
('crazy-train','chitarra','Crazy Train','Ozzy Osbourne','Blizzard of Ozz',1980,'Metal',4,138,'F# minore','Standard (EADGBE)',E'e|--------------------------------|\nB|--------------------------------|\nG|--------------------------------|\nD|---------4---------2-0----------|\nA|-----4-5---5-4-2-----------0-2--|\nE|-2-2----------------------------|'),
('sultans-of-swing','chitarra','Sultans of Swing','Dire Straits','Dire Straits',1978,'Classic Rock',4,148,'D minore','Standard (EADGBE)',NULL),
('californication','chitarra','Californication','Red Hot Chili Peppers','Californication',1999,'Alternative',2,96,'A minore','Standard (EADGBE)',NULL),
('zombie','chitarra','Zombie','The Cranberries','No Need to Argue',1994,'Alternative',1,84,'E minore','Standard (EADGBE)',NULL),
('wonderwall','chitarra','Wonderwall','Oasis','(What''s the Story) Morning Glory?',1995,'Britpop',1,87,'F# minore','Standard, capo al 2°',NULL),
('chop-suey','chitarra','Chop Suey!','System of a Down','Toxicity',2001,'Metal',3,127,'C# minore','Drop C',NULL),
('one','chitarra','One','Metallica','...And Justice for All',1988,'Metal',4,108,'B minore','Standard (EADGBE)',NULL),
('another-one','basso','Another One Bites the Dust','Queen','The Game',1980,'Rock',1,110,'E minore','Standard (EADG)',E'G|----------------|\nD|----------------|\nA|-------------5--|\nE|-0-0-0------3---|'),
('billie-jean-bass','basso','Billie Jean','Michael Jackson','Thriller',1982,'Pop',2,117,'F# minore','Standard (EADG)',E'G|-----------------|\nD|-4-----4---------|\nA|---4-2---2-4-2---|\nE|-2---------------|'),
('hysteria','basso','Hysteria','Muse','Absolution',2003,'Alternative',5,94,'A minore','Standard (EADG)',NULL),
('come-together','basso','Come Together','The Beatles','Abbey Road',1969,'Classic Rock',2,82,'D minore','Standard (EADG)',NULL),
('under-pressure','basso','Under Pressure','Queen & David Bowie','Hot Space',1981,'Rock',1,114,'D maggiore','Standard (EADG)',NULL),
('money','basso','Money','Pink Floyd','The Dark Side of the Moon',1973,'Progressive',3,123,'B minore','Standard (EADG)',NULL),
('cant-stop','basso','Can''t Stop','Red Hot Chili Peppers','By the Way',2002,'Funk Rock',3,92,'E minore','Standard (EADG)',NULL),
('longview','basso','Longview','Green Day','Dookie',1994,'Punk',3,146,'E maggiore','Standard (EADG)',NULL),
('fur-elise','pianoforte','Für Elise','Ludwig van Beethoven','Beethoven: Piano Works',1810,'Classica',2,72,'A minore','—',E'Mano destra:\nE D# E D# E B D C A  |  C E A B  |  E G# B C\nE D# E D# E B D C A  |  C E A B  |  E C B A'),
('clair-de-lune','pianoforte','Clair de Lune','Claude Debussy','Suite bergamasque',1905,'Classica',4,50,'Db maggiore','—',NULL),
('moonlight','pianoforte','Sonata al chiaro di luna (I mov.)','Ludwig van Beethoven','Piano Sonata No. 14',1801,'Classica',3,54,'C# minore','—',E'Mano destra (terzine):\nG# C# E  G# C# E  G# C# E  G# C# E\nA  C# E  A  C# E  A  D  F# A  D  F#\nMano sinistra: C#  B  A  F#'),
('gymnopedie','pianoforte','Gymnopédie No. 1','Erik Satie','Trois Gymnopédies',1888,'Classica',2,70,'D maggiore','—',NULL),
('river-flows','pianoforte','River Flows in You','Yiruma','First Love',2001,'Neoclassica',3,65,'A maggiore','—',E'Mano destra:\nA G# A G# A E A D  |  A C# D E C# B\nA G# A G# A E A D  |  A C# D E F# E'),
('nuvole-bianche','pianoforte','Nuvole Bianche','Ludovico Einaudi','Una Mattina',2004,'Neoclassica',3,80,'F minore','—',NULL),
('experience','pianoforte','Experience','Ludovico Einaudi','In a Time Lapse',2013,'Neoclassica',3,80,'F# minore','—',NULL),
('comptine','pianoforte','Comptine d''un autre été','Yann Tiersen','Le Fabuleux Destin d''Amélie Poulain',2001,'Colonna sonora',3,96,'E minore','—',NULL),
('bohemian','pianoforte','Bohemian Rhapsody','Queen','A Night at the Opera',1975,'Rock',4,72,'Bb maggiore','—',NULL),
('let-it-be','pianoforte','Let It Be','The Beatles','Let It Be',1970,'Pop',1,72,'C maggiore','—',E'Accordi:\nC  G  Am  F  |  C  G  F  C\nC  G  Am  F  |  C  G  F  C'),
('imagine','pianoforte','Imagine','John Lennon','Imagine',1971,'Pop',1,76,'C maggiore','—',E'Accordi:\nC  Cmaj7  F  |  C  Cmaj7  F\nAm  Dm  F  G  G7'),
('piano-man','pianoforte','Piano Man','Billy Joel','Piano Man',1973,'Pop',3,178,'C maggiore','—',NULL),
('someone-like-you','pianoforte','Someone Like You','Adele','21',2011,'Pop',2,67,'A maggiore','—',E'Accordi (arpeggiati):\nA  C#m  F#m  D\nA  C#m  F#m  D'),
('dont-stop-me-now','pianoforte','Don''t Stop Me Now','Queen','Jazz',1978,'Rock',4,156,'F maggiore','—',NULL),
('clocks','pianoforte','Clocks','Coldplay','A Rush of Blood to the Head',2002,'Alternative',2,131,'Eb maggiore','—',E'Mano destra (arpeggio):\nEb Bb G  Eb Bb G  Eb Bb\nDb Bb F  Db Bb F  Db Bb\nC  Ab F  C  Ab F  C  Ab'),
('your-song','pianoforte','Your Song','Elton John','Elton John',1970,'Pop',3,64,'Eb maggiore','—',NULL),
('we-will-rock-you','batteria','We Will Rock You','Queen','News of the World',1977,'Rock',1,81,'—','—',E'HH |----------------|\nSN |----x-------x---|\nBD |x-x-----x-x-----|'),
('back-in-black-drums','batteria','Back in Black','AC/DC','Back in Black',1980,'Hard Rock',1,94,'—','—',E'HH |x-x-x-x-x-x-x-x-|\nSN |----o-------o---|\nBD |o-------o-o-----|'),
('teen-spirit-drums','batteria','Smells Like Teen Spirit','Nirvana','Nevermind',1991,'Grunge',2,117,'—','—',NULL),
('in-the-air','batteria','In the Air Tonight','Phil Collins','Face Value',1981,'Pop',2,96,'—','—',NULL),
('billie-jean-drums','batteria','Billie Jean','Michael Jackson','Thriller',1982,'Pop',1,117,'—','—',E'HH |x-x-x-x-x-x-x-x-|\nSN |----o-------o---|\nBD |o-------o-------|'),
('rosanna','batteria','Rosanna','Toto','Toto IV',1982,'Rock',5,86,'—','—',NULL),
('enter-sandman-drums','batteria','Enter Sandman','Metallica','Metallica',1991,'Metal',3,123,'—','—',NULL),
('walk-this-way','batteria','Walk This Way','Aerosmith','Toys in the Attic',1975,'Hard Rock',2,109,'—','—',NULL);

INSERT INTO public.tones VALUES
('enter-sandman','Mesa/Boogie Dual Rectifier','Ponte (humbucker attivo)',7,7,4,6,6,1,'Wah per l''assolo, noise gate','Scoop leggero sulle medie, doppia la ritmica a sinistra e destra.'),
('master-of-puppets','Mesa/Boogie Mark IIC+','Ponte',8,6,3,7,6,1,'Tube Screamer (gain 0, level 10), noise gate','Pennata in downpicking stretto: il suono viene dalla mano destra.'),
('nothing-else-matters','Fender Twin Reverb','Manico',1,6,6,6,5,4,'Chorus leggero, compressore','Arpeggio pulito con dita o plettro morbido.'),
('smoke-on-the-water','Marshall Plexi','Ponte',5,6,7,6,5,2,'Nessuno','Suona a bicordi di quarta pizzicando due corde con le dita.'),
('back-in-black','Marshall JCM800','Ponte',5,5,7,6,6,1,'Nessuno','Meno gain di quanto pensi: il crunch AC/DC è quasi pulito.'),
('highway-to-hell','Marshall Plexi','Ponte',5,5,7,6,6,1,'Nessuno','Accordi aperti pieni, lascia suonare le corde.'),
('thunderstruck','Marshall JCM800','Ponte',6,5,7,6,6,2,'Delay corto 80 ms','Solo mano sinistra (hammer e pull-off), palm mute con la destra.'),
('sweet-child','Marshall JCM800 (modificato)','Manico',6,5,7,5,6,3,'Delay leggero','Volume chitarra al 7 per la strofa, al 10 per l''assolo.'),
('paranoid','Marshall Super Lead','Ponte',6,6,7,5,5,1,'Fuzz leggero','Riff in power chord, pennata alternata veloce.'),
('iron-man','Laney Supergroup','Ponte',7,7,6,5,5,2,'Treble booster','Iommi accorda a volte mezzo tono sotto.'),
('seven-nation-army','Amp Silvertone / Fender','Manico',6,7,5,4,4,1,'Whammy (ottava sotto)','Con la Whammy la chitarra sembra un basso.'),
('teen-spirit','Mesa Studio Preamp','Ponte',7,7,5,6,5,1,'Chorus sulle strofe, distorsore Boss DS-1','Strofa pulita col chorus, ritornello a palla.'),
('come-as-you-are','Fender Twin Reverb','Manico',2,6,5,5,5,3,'Chorus Electro-Harmonix','Accordatura un tono sotto per il riff.'),
('stairway','Supro / Marshall','Manico (arpeggio), ponte (assolo)',2,5,6,6,5,4,'Nessuno','Inizia con arpeggio pulito, aggiungi gain solo nel finale.'),
('whole-lotta-love','Marshall Plexi','Ponte',7,6,7,6,6,2,'Theremin (opzionale)','Riff molto cattivo ma dinamico.'),
('hotel-california','Fender Twin / Mesa','Manico (assolo)',5,5,6,6,5,4,'Delay 320 ms','Assolo armonizzato a due chitarre.'),
('comfortably-numb','Hiwatt DR103','Ponte',7,5,6,6,6,5,'Big Muff, delay 420 ms, Leslie','Lascia respirare le note: bending lenti e larghi.'),
('wish-you-were-here','Acustica / Fender pulito','Manico',0,6,6,6,5,3,'Nessuno','Originale su 12 corde acustica.'),
('purple-haze','Marshall Super Lead','Manico',7,6,6,6,5,2,'Fuzz Face, Octavia','L''accordo E7#9 è il marchio di Hendrix.'),
('sunshine','Marshall JTM45','Manico, tono a 0',7,7,7,3,3,2,'Fuzz','Il "woman tone" di Clapton: tono della chitarra chiuso.'),
('johnny-b-goode','Fender Tweed','Ponte',4,5,7,7,6,3,'Slapback delay','Doppi bending su due corde.'),
('layla','Fender Champ','Centro',6,5,7,6,5,2,'Nessuno','Riff all''unisono con due chitarre.'),
('crazy-train','Marshall JCM800 + boost','Ponte',8,6,6,7,7,2,'MXR Distortion+, chorus','Pennata alternata precisa e palm mute.'),
('sultans-of-swing','Fender Vibrolux','Posizione 4 (ponte+centro)',2,5,7,7,6,3,'Nessuno','Suonata con le dita, senza plettro.'),
('californication','Marshall Major','Manico',3,6,6,6,5,3,'Nessuno','Arpeggio pulito e leggero.'),
('zombie','Mesa Boogie','Ponte',7,7,5,6,5,3,'Nessuno','Strofa pulita, ritornello distorto.'),
('wonderwall','Acustica','—',0,5,6,6,5,2,'Nessuno','Capotasto al secondo tasto.'),
('chop-suey','Mesa Dual Rectifier','Ponte',8,7,4,6,6,1,'Noise gate','Accordatura Drop C, pennate veloci in alternata.'),
('one','Mesa Mark IIC+','Ponte',8,6,4,7,6,2,'Chorus nell''intro pulito','Intro pulito, poi mitragliata di doppia cassa in sezione finale.'),
('another-one','Ampeg SVT','Manico',1,7,5,4,4,0,'Compressore','Note staccate e muting preciso.'),
('billie-jean-bass','Ampeg B-15','Manico',0,7,5,4,4,0,'Compressore','Groove regolare e leggero.'),
('hysteria','Ampeg + fuzz','Ponte',7,7,6,6,5,0,'Fuzz, octaver','Sedicesimi in alternata con due dita.'),
('come-together','Vox / Fender','Manico',1,7,5,4,4,1,'Nessuno','Slide sulla prima nota del riff.'),
('under-pressure','Ampeg','Manico',1,6,5,5,5,1,'Nessuno','Riff ripetuto, regolarità prima di tutto.'),
('money','Hiwatt','Manico',2,7,5,4,4,2,'Nessuno','Tempo in 7/4.'),
('cant-stop','Gallien-Krueger','Ponte',2,6,6,6,5,1,'Compressore','Stile funk molto staccato.'),
('longview','Ampeg','Ponte',3,6,6,6,5,0,'Nessuno','Linea con pennata alternata.'),
('fur-elise','Gran coda classico','—',0,5,5,5,5,3,'Pedale di risonanza leggero','Leggerezza e legato nella mano destra.'),
('clair-de-lune','Gran coda (patch "Concert")','—',0,6,5,4,4,6,'Pedale abbondante','Dinamica pp: suona piano davvero.'),
('moonlight','Gran coda','—',0,7,5,4,4,5,'Pedale ad ogni cambio d''accordo','Terzine regolari, melodia in rilievo.'),
('gymnopedie','Gran coda','—',0,6,5,4,4,5,'Pedale','Tempo lento e costante.'),
('river-flows','Pianoforte "Bright Grand"','—',0,5,5,6,5,4,'Pedale','Fluido, senza accenti forti.'),
('nuvole-bianche','Upright felt','—',0,6,5,4,4,5,'Pedale','Su digitale usa un piano "felt" o con sordina.'),
('experience','Gran coda','—',0,6,5,5,5,5,'Pedale','Crescendo graduale.'),
('comptine','Upright','—',0,5,5,6,5,3,'Pedale moderato','Mano sinistra veloce e regolare.'),
('bohemian','Bösendorfer / gran coda','—',0,6,5,5,5,3,'Pedale','Mercury usava un Bechstein.'),
('let-it-be','Pianoforte rock','—',0,6,6,5,5,2,'Pedale','Accordi semplici, mano sinistra con ottave.'),
('imagine','Upright','—',0,6,5,5,5,3,'Pedale','Ritmo regolare in ottavi.'),
('piano-man','Pianoforte "Bright"','—',0,5,6,6,5,2,'Pedale','Tempo in 3/4.'),
('someone-like-you','Gran coda','—',0,6,5,5,5,4,'Pedale','Arpeggio continuo in sedicesimi.'),
('dont-stop-me-now','Pianoforte rock','—',0,5,6,6,6,2,'Pedale','Accordi ribattuti e veloci.'),
('clocks','Pianoforte "Bright"','—',0,5,6,7,6,3,'Delay leggero','Arpeggio in 3-3-2.'),
('your-song','Upright','—',0,6,5,5,5,3,'Pedale','Accompagnamento delicato.'),
('we-will-rock-you','Stomp + clap','—',0,8,4,5,4,5,'Room reverb','Cassa-cassa-rullante.'),
('back-in-black-drums','Rock kit','—',0,7,5,6,5,2,'Nessuno','Groove semplice e solido.'),
('teen-spirit-drums','Rock kit','—',0,7,5,6,5,2,'Nessuno','Fill iniziale famoso.'),
('in-the-air','Gated reverb','—',0,8,4,6,5,8,'Gated reverb','Il fill dei tom col gated reverb.'),
('billie-jean-drums','Pop kit','—',0,7,5,6,5,1,'Nessuno','Groove dritto e preciso.'),
('rosanna','Rosanna shuffle','—',0,6,5,6,5,3,'Nessuno','Half-time shuffle di Jeff Porcaro.'),
('enter-sandman-drums','Metal kit','—',0,7,4,7,6,2,'Nessuno','Lars Ulrich, groove rock.'),
('walk-this-way','Rock kit','—',0,7,5,6,5,2,'Nessuno','Groove funky.');

INSERT INTO public.exercises VALUES
('g-spider','chitarra','Spider walk 1-2-3-4','Tecnica',1,10,80,'Indipendenza delle dita e sincronia tra le mani.','Dita 1-2-3-4 su ogni corda dal 1° tasto|Sali e scendi lentamente|Aumenta 5 BPM quando è pulito',E'e|-----------------------1-2-3-4-|\nB|-----------------1-2-3-4-------|\nG|-----------1-2-3-4-------------|\nD|-----1-2-3-4-------------------|\nA|-1-2-3-4-----------------------|'),
('g-pentatonic','chitarra','Pentatonica minore (box 1)','Scale',1,15,90,'La scala del rock e del blues in La minore.','Posizione al 5° tasto|Su e giù in ottavi|Improvvisa su una base in La',E'e|-------------------------5-8-|\nB|---------------------5-8-----|\nG|-----------------5-7---------|\nD|-------------5-7-------------|\nA|---------5-7-----------------|\nE|-5-8-------------------------|'),
('g-alternate','chitarra','Pennata alternata','Tecnica',2,10,100,'Giù-su costante per velocità e precisione.','Una nota, 4 pennate per beat|Accento sul primo|Passa alle corde vicine',NULL),
('g-palmmute','chitarra','Palm muting metal','Ritmica',2,10,120,'Mano destra appoggiata al ponte per il "chug".','Corda di Mi vuota|Ottavi poi sedicesimi|Alterna note muted e aperte',NULL),
('g-bending','chitarra','Bending intonato','Espressività',3,10,70,'Bending di un tono controllato con l''accordatore.','Nota di riferimento al 9° tasto|Bending dal 7° per raggiungerla|Vibrato in cima',NULL),
('g-chords','chitarra','Cambi di accordi aperti','Accordi',1,10,70,'G - C - D - Em senza fermarsi.','Un accordo per battuta|Poi due per battuta|Ascolta che tutte le corde suonino',NULL),
('g-legato','chitarra','Hammer-on e pull-off','Tecnica',3,10,90,'Legato fluido come nell''intro di Thunderstruck.','Corda di Si vuota|Alterna 0-4-0-2|Solo mano sinistra',NULL),
('g-sweep','chitarra','Sweep picking a 3 corde','Shred',4,15,60,'Arpeggi minori con una pennata continua.','Am: 12-17-14-13|Muting con entrambe le mani|Molto lento all''inizio',NULL),
('b-root','basso','Fondamentali in ottavi','Groove',1,10,90,'La base di ogni bassista.','Una nota per accordo|Ottavi regolari|Suona col metronomo',NULL),
('b-fingers','basso','Alternanza indice-medio','Tecnica',1,10,80,'Plucking regolare con due dita.','Corda vuota|Indice-medio alternati|Volume uguale tra le dita',NULL),
('b-octaves','basso','Ottave disco','Groove',2,10,110,'Il movimento della disco e del funk.','Fondamentale e ottava|Ottavi|Muting della corda non suonata',NULL),
('b-slap','basso','Slap & pop','Tecnica',3,15,80,'Pollice sulla corda grave, pop con l''indice.','Slap sul Mi vuoto|Pop sul Sol al 12°|Combina in sedicesimi',NULL),
('p-c-scale','pianoforte','Scala di Do maggiore','Scale',1,10,70,'Diteggiatura 1-2-3-1-2-3-4-5.','Mano destra da sola|Mano sinistra 5-4-3-2-1-3-2-1|Mani insieme',E'Do Re Mi | Fa Sol La Si Do\n1  2  3  | 1  2   3  4  5'),
('p-hanon','pianoforte','Hanon n. 1','Tecnica',2,15,80,'Indipendenza delle dita classica.','Mani insieme|Polso rilassato|Aumenta il tempo gradualmente',NULL),
('p-triads','pianoforte','Triadi e rivolti','Accordi',2,10,60,'Accordi maggiori e minori in tutti i rivolti.','Do - Mi - Sol|Primo rivolto Mi - Sol - Do|Secondo rivolto Sol - Do - Mi',NULL),
('p-arpeggio','pianoforte','Arpeggi a due ottave','Tecnica',3,15,70,'Passaggio del pollice fluido.','Do maggiore|La minore|Fa maggiore',NULL),
('p-sight','pianoforte','Lettura a prima vista','Lettura',2,10,60,'Leggi 8 battute nuove ogni giorno.','Guarda chiave e tonalità|Batti il ritmo|Suona senza fermarti',NULL),
('d-rudiment','batteria','Single e double stroke','Rudimenti',1,10,80,'DSDS e DDSS sul pad.','Single stroke 4 minuti|Double stroke 4 minuti|Accenti sul primo',NULL),
('d-paradiddle','batteria','Paradiddle','Rudimenti',2,10,90,'DSDD SDSS.','Sul rullante|Sposta gli accenti sui tom|Usalo come groove sul charleston',NULL),
('d-rock','batteria','Groove rock base','Groove',1,10,100,'Charleston in ottavi, rullante su 2 e 4.','Solo charleston|Aggiungi rullante|Aggiungi cassa su 1 e 3',NULL),
('d-fill','batteria','Fill di una battuta','Fill',2,10,90,'Fill in sedicesimi sui tom.','Rullante 4 colpi|Tom 1 e tom 2|Timpano e crash',NULL),
('d-shuffle','batteria','Shuffle a terzine','Groove',3,15,80,'Swing con la ghost note.','Terzine sul charleston|Togli la nota centrale|Aggiungi ghost note sul rullante',NULL);
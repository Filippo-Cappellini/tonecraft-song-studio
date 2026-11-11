-- Altre batterie: nuove marche e nuovi modelli (aggiunti a Pearl, Tama e DW).
INSERT INTO public.brands VALUES
('yamaha-d','batteria','Yamaha','Giappone',1887,'Dalle Stage Custom alle Recording Custom: suono definito e affidabile.',4),
('ludwig','batteria','Ludwig','USA',1909,'La batteria del rock classico, famosa per i suoi fusti in acero.',5),
('gretsch-d','batteria','Gretsch','USA',1883,'Suono caldo e rotondo, amata dal jazz e dal rock.',6),
('sonor','batteria','Sonor','Germania',1875,'Costruzione tedesca precisa, dal set per iniziare a quello da studio.',7),
('mapex','batteria','Mapex','Taiwan',NULL,'Set versatili e a prezzo accessibile, dall''Armory al Saturn.',8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.models VALUES
('pearl-export','pearl','Export EXX','kit','#0d0d0d','gloss',NULL,'black','—','Set completo per iniziare, finitura nera e hardware robusto.',749,2),
('pearl-decade','pearl','Decade Maple','kit','#c9a46a','natural',NULL,'chrome','—','Fusti in acero, suono caldo e definito.',1899,3),
('tama-superstar','tama','Superstar Classic','kit','#7a3b1a','sunburst',NULL,'chrome','—','Set versatile, dal rock al jazz.',1799,2),
('tama-club-jam','tama','Club-JAM','kit','#1f3b73','metallic',NULL,'chrome','—','Kit compatto da portare ovunque, ottimo per i piccoli palchi.',449,3),
('dw-design','dw','Design Series','kit','#0d0d0d','gloss',NULL,'black','—','Fusti in acero con hardware nero, suono professionale.',2599,2),
('dw-performance','dw','Performance Series','kit','#3a2416','natural',NULL,'chrome','—','Fusti in acero, suono caldo e ricco di corpo.',4299,3),
('yamaha-stage','yamaha-d','Stage Custom Birch','kit','#7a0b0b','metallic',NULL,'chrome','—','Fusti in betulla: attacco deciso e suono brillante.',1099,1),
('yamaha-recording','yamaha-d','Recording Custom','kit','#e6d3a3','natural',NULL,'chrome','—','Fusti in betulla, pensati per lo studio di registrazione.',2299,2),
('yamaha-tour','yamaha-d','Tour Custom','kit','#0b0b0b','gloss',NULL,'black','—','Hardware nero e suono potente per i palchi.',2899,3),
('ludwig-classic','ludwig','Classic Maple','kit','#7a3b1a','sunburst',NULL,'chrome','—','Il suono rock classico: acero e finiture vintage.',2499,1),
('ludwig-legacy','ludwig','Legacy Maple','kit','#1f3b73','metallic',NULL,'chrome','—','Acero e dettagli moderni, versatile in ogni genere.',2199,2),
('ludwig-breakbeats','ludwig','Breakbeats','kit','#c9a46a','natural',NULL,'chrome','—','Kit ultra compatto con cassa piccola, ideale a basso volume.',549,3),
('gretsch-renown','gretsch-d','Renown','kit','#7a1414','gloss',NULL,'chrome','—','Suono caldo e rotondo in finitura rosso lucido.',2199,1),
('gretsch-catalina','gretsch-d','Catalina Club','kit','#3a2416','natural',NULL,'chrome','—','Kit leggero e trasportabile, perfetto per il jazz.',899,2),
('sonor-aq2','sonor','AQ2','kit','#0d0d0d','gloss',NULL,'chrome','—','Set completo con buon rapporto qualità/prezzo.',899,1),
('sonor-sq1','sonor','SQ1','kit','#7a0b0b','gloss',NULL,'chrome','—','Fusti in betulla, suono professionale e molto personalizzabile.',3299,2),
('mapex-armory','mapex','Armory','kit','#0b0b0b','gloss',NULL,'black','—','Hardware nero e suono pieno per rock e metal.',1699,1),
('mapex-saturn','mapex','Saturn Evolution','kit','#7a3b1a','sunburst',NULL,'chrome','—','Suono caldo e brillante, set da professionisti.',3599,2),
('mapex-tornado','mapex','Tornado Compact','kit','#1f3b73','metallic',NULL,'chrome','—','Set compatto e completo per chi inizia.',379,3)
ON CONFLICT (id) DO NOTHING;

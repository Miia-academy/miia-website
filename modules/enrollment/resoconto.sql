-- Resoconto delle iscrizioni online: solo lettura, da eseguire nella console Neon
-- (SQL Editor). Non usa cookie né GA4: conta tutte le persone, anche chi rifiuta
-- i cookie. Le prove interne si escludono con il filtro sulle email @miia.it.
--
-- Passi: chi_sei, corso, dati, profilo, consensi, firma.
-- Una riga di iscrizioni.iscrizioni nasce quando la persona verifica l'email.

-- 1. Per settimana: quante iniziano, fin dove arrivano, quante firmano.
SELECT
  date_trunc('week', creata_il)::date                                  AS settimana,
  count(*)                                                             AS iniziate,
  count(*) FILTER (WHERE 'chi_sei'  = ANY (sezioni_complete))          AS passo_1_chi_sei,
  count(*) FILTER (WHERE 'corso'    = ANY (sezioni_complete))          AS passo_2_corso,
  count(*) FILTER (WHERE 'dati'     = ANY (sezioni_complete))          AS passo_3_dati,
  count(*) FILTER (WHERE 'profilo'  = ANY (sezioni_complete))          AS passo_4_profilo,
  count(*) FILTER (WHERE 'consensi' = ANY (sezioni_complete))          AS passo_5_consensi,
  count(*) FILTER (WHERE stato IN ('firmata', 'definitiva'))           AS firmate,
  count(*) FILTER (WHERE stato = 'recesso')                            AS recessi,
  coalesce(sum(pagamento_totale) FILTER (WHERE stato IN ('firmata', 'definitiva')), 0) AS valore_firmato
FROM iscrizioni.iscrizioni
WHERE email NOT LIKE '%@miia.it'
GROUP BY 1
ORDER BY 1 DESC;

-- 2. Per provenienza (prima visita e ultima visita prima dell'iscrizione).
--    "(diretto)" = nessuna sorgente registrata: link digitato, preferiti, o
--    provenienza non salvata perché la persona ha rifiutato i cookie.
SELECT
  coalesce(provenienza ->> 'origine_sorgente', '(diretto)')  AS origine_sorgente,
  coalesce(provenienza ->> 'origine_campagna', '')           AS origine_campagna,
  coalesce(provenienza ->> 'ultima_sorgente', '(diretto)')   AS ultima_sorgente,
  coalesce(provenienza ->> 'ultima_campagna', '')            AS ultima_campagna,
  count(*)                                                   AS iniziate,
  count(*) FILTER (WHERE stato IN ('firmata', 'definitiva')) AS firmate,
  round(100.0 * count(*) FILTER (WHERE stato IN ('firmata', 'definitiva')) / count(*), 1) AS percentuale_firmate,
  coalesce(sum(pagamento_totale) FILTER (WHERE stato IN ('firmata', 'definitiva')), 0) AS valore_firmato
FROM iscrizioni.iscrizioni
WHERE email NOT LIKE '%@miia.it'
  AND creata_il >= now() - interval '90 days'
GROUP BY 1, 2, 3, 4
ORDER BY firmate DESC, iniziate DESC;

-- 3. Iscrizioni ferme: bozze non toccate da più di 2 giorni, con il passo a cui
--    si sono fermate. Utile per un contatto della segreteria.
SELECT
  email,
  nome,
  cognome,
  corso,
  CASE
    WHEN NOT 'chi_sei'  = ANY (sezioni_complete) THEN '1 Chi sei'
    WHEN NOT 'corso'    = ANY (sezioni_complete) THEN '2 Corso e pagamento'
    WHEN NOT 'dati'     = ANY (sezioni_complete) THEN '3 Dati e documenti'
    WHEN NOT 'profilo'  = ANY (sezioni_complete) THEN '4 Profilo'
    WHEN NOT 'consensi' = ANY (sezioni_complete) THEN '5 Consensi'
    ELSE '6 Firma'
  END                       AS fermo_al_passo,
  aggiornata_il::date       AS ultimo_movimento,
  provenienza ->> 'ultima_sorgente' AS ultima_sorgente
FROM iscrizioni.iscrizioni
WHERE stato = 'bozza'
  AND email NOT LIKE '%@miia.it'
  AND aggiornata_il < now() - interval '2 days'
ORDER BY aggiornata_il DESC;

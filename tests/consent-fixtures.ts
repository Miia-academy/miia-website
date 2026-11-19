/** Storie "term_condition" di prova, come arrivano dalla Content Delivery API. */
export const STORIES = [
  {
    slug: 'contratto',
    position: -100,
    content: {
      titolo: 'Contratto',
      riferimento: 'art. a-n',
      descrizione: '- La retta è dovuta per intero.\n- Le lezioni perse non si recuperano.',
      testo_completo: 'a) Oggetto del contratto: corso “Interior design”.\n\nb) Durata… fino a € 5.490.',
      tipo: 'spunta',
      etichetta: 'Ho letto e accetto le condizioni generali di contratto',
      obbligatorio: true,
    },
  },
  {
    slug: 'recesso',
    position: -80,
    content: { titolo: 'Diritto di recesso', descrizione: 'Puoi annullare entro 14 giorni dalla firma.', tipo: 'spunta', etichetta: 'Ho capito come recedere', obbligatorio: true },
  },
  {
    slug: 'foto',
    position: -60,
    content: {
      titolo: 'Fotografie e video',
      tipo: 'si_no',
      etichetta: 'Sì, autorizzo',
      etichetta_no: 'No, non autorizzo',
      nota_no: 'Niente visite in azienda.',
      obbligatorio: true,
    },
  },
  {
    slug: 'newsletter',
    position: -50,
    content: { titolo: 'Comunicazioni', tipo: 'spunta', etichetta: 'Voglio ricevere novità', obbligatorio: false },
  },
]

/** Le stesse storie con un campo di una voce cambiato. */
export function changed(slug: string, field: string, value: unknown) {
  return STORIES.map((s) => (s.slug === slug ? { ...s, content: { ...s.content, [field]: value } } : s))
}

/** Risposte valide a tutte le voci obbligatorie. */
export const ANSWERS = { contratto: true, recesso: true, foto: 'si', newsletter: false }

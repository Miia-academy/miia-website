import type { ComponentSchema } from "../props/schema";

const action: ComponentSchema = {
  name: "action",
  display_name: "Collegamento",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.label}}`,
  schema: {
    label: {
      type: "markdown",
      display_name: "Etichetta",
      customize_toolbar: true,
      rich_markdown: true,
      toolbar: ["inlinecode"],
      required: true,
    },
    link: {
      type: "multilink",
      display_name: "Destinazione",
      restrict_content_types: true,
      component_whitelist: ["page", "article"],
      show_anchor: true,
      asset_link_type: true,
    },
    external: {
      type: "boolean",
      display_name: "Apri nuova finestra",
      inline_label: true,
    },
    button: {
      type: "boolean",
      display_name: "Mostra come bottone",
      inline_label: true,
    },
    color: {
      type: "option",
      display_name: "Colore",
      options: [
        { value: "primary", name: "Primario" },
        { value: "secondary", name: "Secondario" },
      ],
    },
    id: {
      type: "text",
      display_name: "Tracciamento",
    },
  },
};

const text: ComponentSchema = {
  name: "text",
  display_name: "Testo",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.title}}`,
  schema: {
    title: {
      type: "markdown",
      display_name: "Titolo",
      customize_toolbar: true,
      rich_markdown: true,
      toolbar: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "link",
        "inlinecode",
        "italic",
        "bold",
        "hrule",
      ],
    },
    description: {
      type: "markdown",
      display_name: "Descrizione",
      customize_toolbar: true,
      rich_markdown: true,
      toolbar: [
        "bold",
        "paragraph",
        "list",
        "olist",
        "hrule",
        "link",
        "inlinecode",
      ],
    },
    justify: {
      type: "option",
      display_name: "Giustifica",
      options: [
        { value: "right", name: "Destra" },
        { value: "center", name: "Centro" },
        { value: "left", name: "Sinistra" },
      ],
    },
    width: {
      type: "options",
      display_name: "Larghezza",
      options: [
        { value: "1/4", name: "Un quarto" },
        { value: "1/3", name: "Un terzo" },
        { value: "1/2", name: "Metà" },
        { value: "2/3", name: "Due terzi" },
        { value: "3/4", name: "Tre quarti" },
        { value: "1/1", name: "Intera" },
      ],
      default_value: ["1/2"],
      description:
        "Larghezza rispetto alla sezione. Usare più opzioni per schermi sempre più grandi.",
      tooltip: true,
      max_options: 4,
    },
    theme: {
      type: "option",
      display_name: "Tema",
      options: [
        { value: "primary", name: "Primario" },
        { value: "secondary", name: "Secondario" },
      ],
    },
    order: {
      type: "number",
      display_name: "Riordino mobile",
      max_value: 6,
      min_value: 0,
    },
    hide: {
      type: "option",
      display_name: "Nascondi mobile",
      options: [
        { value: "title", name: "Titolo" },
        { value: "description", name: "Descrizione" },
        { value: "all", name: "Tutto" },
      ],
    },
  },
};

const image: ComponentSchema = {
  name: "image",
  display_name: "Immagine",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.image.alt}}`,
  schema: {
    image: {
      type: "asset",
      display_name: "Immagine",
      filetypes: ["images"],
      required: true,
    },
    width: {
      type: "options",
      display_name: "Larghezza",
      options: [
        { value: "1/4", name: "Un quarto" },
        { value: "1/3", name: "Un terzo" },
        { value: "1/2", name: "Metà" },
        { value: "2/3", name: "Due terzi" },
        { value: "3/4", name: "Tre quarti" },
        { value: "1/1", name: "Intera" },
      ],
      default_value: ["1/2"],
      description:
        "Larghezza rispetto alla sezione. Usare più opzioni per schermi sempre più grandi.",
      tooltip: true,
      max_options: 4,
    },
    size: {
      type: "option",
      display_name: "Dimensione",
      options: [
        { value: "sm", name: "Piccola" },
        { value: "md", name: "Media" },
        { value: "lg", name: "Grande" },
      ],
      description: "Dimensione fissa immagine",
      tooltip: true,
    },
    aspect: {
      type: "option",
      display_name: "Aspetto",
      options: [
        { value: "1/1", name: "Quadrata" },
        { value: "3/4", name: "Verticale" },
        { value: "4/9", name: "Verticale stretta" },
        { value: "4/3", name: "Orizzontale" },
        { value: "9/4", name: "Orizzontale larga" },
      ],
      description: "Proporzioni immagine",
      tooltip: true,
    },
    order: {
      type: "number",
      display_name: "Riordino mobile",
      max_value: 6,
      min_value: 0,
    },
    fullScreen: {
      type: "boolean",
      display_name: "Mostra tutto schemo",
      inline_label: true,
      default_value: false,
    },
    author: {
      type: "option",
      display_name: "Autore",
      source: "internal_stories",
      filter_content_type: ["person"],
    },
  },
};

const gallery: ComponentSchema = {
  name: "gallery",
  display_name: "Galleria",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.images.alt}}`,
  schema: {
    images: {
      type: "multiasset",
      display_name: "Immagini",
      filetypes: ["images"],
      required: true,
    },
    size: {
      type: "option",
      display_name: "Grandezza",
      options: [
        { value: "1/2", name: "Metà" },
        { value: "1/4", name: "Un quarto" },
        { value: "1/8", name: "Un ottavo" },
      ],
      default_value: ["1/2"],
      description: "Grandezza delle anteprime",
      tooltip: true,
    },
    aspect: {
      type: "option",
      display_name: "Aspetto",
      options: [
        { value: "1/1", name: "Quadrata" },
        { value: "3/4", name: "Verticale" },
        { value: "4/3", name: "Orizzontale" },
      ],
    },
    width: {
      type: "options",
      display_name: "Larghezza",
      options: [
        { value: "1/4", name: "Un quarto" },
        { value: "1/3", name: "Un terzo" },
        { value: "1/2", name: "Metà" },
        { value: "2/3", name: "Due terzi" },
        { value: "3/4", name: "Tre quarti" },
        { value: "1/1", name: "Intera" },
      ],
      default_value: ["1/2"],
      description:
        "Larghezza rispetto alla sezione. Usare più opzioni per schermi sempre più grandi.",
      tooltip: true,
      max_options: 4,
    },
    fullScreen: {
      type: "boolean",
      display_name: "Mostra tutto schemo",
      inline_label: true,
      default_value: false,
    },
  },
};

const background: ComponentSchema = {
  name: "background",
  display_name: "Sfondo",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.image.alt}}`,
  schema: {
    image: {
      type: "asset",
      display_name: "Immagine",
      filetypes: ["images"],
    },
    video: {
      type: "text",
      display_name: "Video",
      description: "Id del video su youtube",
      inline_label: true,
    },
    position: {
      type: "options",
      display_name: "Posizione",
      description:
        "Posizionamento dell'immagine rispetto ai margini.\nla prima selezione per mobile, la seconda per desktop.",
      tooltip: true,
      options: [
        { value: "right", name: "Destra" },
        { value: "center", name: "Centro" },
        { value: "left", name: "Sinistra" },
      ],
      max_options: 2,
    },
    author: {
      type: "option",
      display_name: "Autore",
      source: "internal_stories",
      filter_content_type: ["person"],
    },
  },
};

const video: ComponentSchema = {
  name: "video",
  display_name: "Video",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: "",
  schema: {
    source: {
      type: "text",
      display_name: "Collegamento",
      required: true,
    },
    width: {
      type: "options",
      display_name: "Larghezza",
      options: [
        { value: "1/4", name: "Un quarto" },
        { value: "1/3", name: "Un terzo" },
        { value: "1/2", name: "Metà" },
        { value: "2/3", name: "Due terzi" },
        { value: "3/4", name: "Tre quarti" },
        { value: "1/1", name: "Intera" },
      ],
      default_value: ["1/2"],
      description:
        "Larghezza rispetto alla sezione. Usare più opzioni per schermi sempre più grandi.",
      tooltip: true,
      max_options: 4,
    },
    order: {
      type: "number",
      display_name: "Riordino mobile",
      max_value: 6,
      min_value: 0,
    },
  },
};

const field: ComponentSchema = {
  name: "field",
  display_name: "Campo",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: ``,
  schema: {
    id: {
      type: "text",
      display_name: "Id",
      required: true,
    },
    input: {
      type: "option",
      display_name: "Tipo",
      options: [
        { value: "text", name: "Testo" },
        { value: "number", name: "Numero" },
        { value: "email", name: "Email" },
        { value: "tel", name: "Telefono" },
        { value: "date", name: "Data" },
        { value: "checkbox", name: "Casella" },
        { value: "area", name: "Messaggio" },
        { value: "select", name: "Selezione" },
        { value: "multiple", name: "Selezione multipla" },
        // { value: 'file', name: 'File' }, //TODO :find a module for file input
        { value: "enroll", name: "Iscrizione" },
        // { value: 'hidden', name: 'Nascosto' },
      ],
      description:
        'Il campo tipo: "Iscrizione" può essere usato solo nelle pagine corso',
      default_value: "text",
      required: true,
    },
    hidden: {
      type: "boolean",
      display_name: "Nascosto",
      default_value: false,
      inline_label: true,
    },
    label: {
      type: "text",
      display_name: "Etichetta",
      required: true,
      max_length: 60,
    },
    placeholder: {
      type: "text",
      display_name: "Segnaposto",
      description: 'Indicare il valore per il tipo "Nascosto"',
      max_length: 140,
    },
    required: {
      type: "boolean",
      display_name: "Obbligatorio",
      default_value: false,
      inline_label: true,
    },
    options: {
      type: "textarea",
      display_name: "Opzioni",
      description: `Solo per il tipo "Selezione".
\nUsare la sintassi chiave:valore e andare a capo per ogni opzione.`,
    },
  },
};

const menu: ComponentSchema = {
  name: "menu",
  display_name: "Menu",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.title}}`,
  schema: {
    title: {
      type: "text",
      display_name: "Titolo",
    },
    links: {
      type: "bloks",
      display_name: "Collegamenti",
      restrict_components: true,
      component_whitelist: ["action"],
      required: true,
    },
    inline: {
      type: "boolean",
      display_name: "Disponi in linea",
      default_value: false,
      inline_label: true,
    },
  },
};

const process: ComponentSchema = {
  name: "process",
  display_name: "Procedura",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.title}}`,
  schema: {
    links: {
      type: "bloks",
      display_name: "Passaggi",
      restrict_components: true,
      component_whitelist: ["wrapper"],
      required: true,
    },
  },
};

const list: ComponentSchema = {
  name: "list",
  display_name: "Fisarmonica",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{@each(it.title)}}`,
  schema: {
    items: {
      type: "bloks",
      display_name: "Testi",
      restrict_components: true,
      component_whitelist: ["text"],
      required: true,
    },
    size: {
      type: "option",
      display_name: "Largezza",
      options: [
        { value: "1/4", name: "Un quarto" },
        { value: "1/3", name: "Un terzo" },
        { value: "1/2", name: "Metà" },
        { value: "2/3", name: "Due terzi" },
        { value: "3/4", name: "Tre quarti" },
      ],
      default_value: "1/2",
    },
  },
};

const alias: ComponentSchema = {
  name: "alias",
  display_name: "Risorsa",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: ``,
  schema: {
    title: {
      type: "text",
      display_name: "Titolo",
    },
    image: {
      type: "asset",
      display_name: "Immagine",
      filetypes: ["images"],
    },
    resource: {
      type: "option",
      display_name: "Tipo",
      options: [
        { value: "next-event", name: "Prossimo evento" },
        { value: "last-article", name: "Ultimo articolo" },
      ],
      required: true,
    },
    filter: {
      type: "text",
      display_name: "Filtra per nome",
      description: "Il nome della risorsa contiene il filtro",
    },
    submit: {
      type: "bloks",
      display_name: "Iscrizione",
      restrict_components: true,
      component_whitelist: ["form"],
      maximum: 1,
    },
  },
};

const aside: ComponentSchema = {
  name: "aside",
  display_name: "Fianco",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.display}}`,
  schema: {
    id: {
      type: "text",
      display_name: "Ancora",
    },
    enrollment: {
      type: "section",
      display_name: "Iscrizione",
      keys: ["amount", "steps", "courses", "forms"],
    },
    amount: {
      type: "number",
      display_name: "Prezzo",
    },
    steps: {
      type: "number",
      display_name: "Rate",
    },
    discount: {
      type: "number",
      display_name: "Sconto (%)",
    },
    due_date: {
      type: "datetime",
      display_name: "Scadenza sconto",
    },
    courses: {
      type: "options",
      display_name: "Corsi",
      source: "internal_stories",
      restrict_content_types: true,
      filter_content_type: ["course"],
      required: true,
    },
    forms: {
      type: "bloks",
      display_name: "Moduli",
      restrict_components: true,
      component_whitelist: ["form"],
      maximum: 3,
      required: true,
    },
    contents: {
      type: "bloks",
      display_name: "Contenuti",
      restrict_components: true,
      component_whitelist: ["process", "text", "action", "wrapper", "alias"],
      required: true,
    },
    theme: {
      type: "option",
      display_name: "Tema",
      options: [{ value: "dark", name: "Scuro" }],
    },
  },
};

const section: ComponentSchema = {
  name: "section",
  display_name: "Sezione",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "containers",
  preview_tmpl: `{{it.id}}`,
  schema: {
    id: {
      type: "text",
      display_name: "Ancora",
    },
    contents: {
      type: "bloks",
      display_name: "Contenuti",
      restrict_components: true,
      component_whitelist: [
        "alias",
        "background",
        "image",
        "gallery",
        "video",
        "list",
        "process",
        "text",
        "action",
        "wrapper",
        "carousel",
        "location",
        "person",
        "event",
        "course",
        "article",
        "form",
      ],
      required: true,
    },
    align: {
      type: "options",
      display_name: "Allinea",
      options: [
        { name: "Sopra", value: "start" },
        { name: "Centro", value: "center" },
        { name: "Sotto", value: "end" },
        { name: "Riempi", value: "stretch" },
      ],
      max_options: 2,
    },
    dark: {
      type: "boolean",
      display_name: "Tema scuro",
      default_value: false,
      inline_label: true,
    },
  },
};

const wrapper: ComponentSchema = {
  name: "wrapper",
  display_name: "Contenitore",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "elements",
  preview_tmpl: `{{it.width}}`,
  schema: {
    contents: {
      type: "bloks",
      display_name: "Contenuti",
      restrict_components: true,
      component_whitelist: [
        "image",
        "video",
        "gallery",
        "background",
        "text",
        "action",
        "list",
        "menu",
        "map",
        "course",
        "person",
        "event",
        "form",
        "carousel",
      ],
      required: true,
    },
    row: {
      type: "boolean",
      display_name: "Orizontale",
      inline_label: true,
    },
    width: {
      type: "options",
      display_name: "Larghezza",
      options: [
        { value: "1/4", name: "Un quarto" },
        { value: "1/3", name: "Un terzo" },
        { value: "1/2", name: "Metà" },
        { value: "2/3", name: "Due terzi" },
        { value: "3/4", name: "Tre quarti" },
        { value: "1/1", name: "Intera" },
      ],
      default_value: ["1/2"],
      description:
        "Larghezza rispetto alla sezione. Usare più opzioni per schermi sempre più grandi.",
      tooltip: true,
      max_options: 4,
    },
    justify: {
      type: "option",
      display_name: "Giustifica",
      options: [
        { value: "right", name: "Destra" },
        { value: "center", name: "Centro" },
        { value: "left", name: "Sinistra" },
      ],
    },
    order: {
      type: "number",
      display_name: "Riordino mobile",
      max_value: 6,
      min_value: 0,
    },
  },
};

const carousel: ComponentSchema = {
  name: "carousel",
  display_name: "Carosello",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "containers",
  preview_tmpl: ``,
  schema: {
    id: {
      type: "text",
      display_name: "Ancora",
    },
    slides: {
      type: "bloks",
      display_name: "Elementi",
      restrict_components: true,
      component_whitelist: ["section", "wrapper", "person", "image"],
      required: true,
    },
    view: {
      type: "number",
      display_name: "Mostra",
      max_value: 3,
      min_value: 0,
      default_value: 0,
      description:
        "Numero minimo di elementi da mostrare per volta.\nZero mostra un solo elemento per volta",
      tooltip: true,
    },
    delay: {
      type: "number",
      display_name: "Scorrimento",
      max_value: 5,
      min_value: 0,
      default_value: 0,
      description: "Velocità di scorrimento automatica",
      tooltip: true,
    },
    order: {
      type: "number",
      display_name: "Riordino mobile",
      max_value: 6,
      min_value: 0,
    },
  },
};

const map: ComponentSchema = {
  name: "map",
  display_name: "Mappa",
  is_root: false,
  is_nestable: true,
  component_group_uuid: "containers",
  preview_tmpl: ``,
  schema: {
    locations: {
      type: "options",
      display_name: "Località",
      source: "internal_stories",
      filter_content_type: ["location"],
      required: true,
    },
  },
};

const form: ComponentSchema = {
  name: "form",
  display_name: "Modulo",
  is_root: true,
  is_nestable: true,
  component_group_uuid: "containers",
  preview_tmpl: `{{it.list}}`,
  schema: {
    alias: {
      type: "option",
      display_name: "Collega",
      source: "internal_stories",
      filter_content_type: ["form"],
    },
    list: {
      type: "options",
      display_name: "Liste",
      options: [
        { value: 31, name: "Moda" },
        { value: 32, name: "interni" },
        { value: 25, name: "Studenti" },
        { value: 26, name: "1 livello" },
        { value: 35, name: "2 livello" },
        { value: 16, name: "Openday" },
        { value: 15, name: "Informazioni" },
        { value: 17, name: "Iscrizione" },
        { value: 28, name: "Clienti" },
        { value: 19, name: "Progetti" },
        { value: 30, name: "Aziende" },
        { value: 33, name: "Assunzioni" },
        { value: 24, name: "Collaborazioni" },
        { value: 29, name: "Docenti" },
        { value: 29, name: "Colloquio" },
      ],
      description: "Selezionare le liste in cui includere i nuovi contatti",
      inline_label: true,
    },
    tracking: {
      type: "options",
      display_name: "Tracciamento",
      options: [
        { value: "enroll", name: "Iscrizione" },
        { value: "open_day", name: "Openday" },
      ],
    },
    new: {
      type: "section",
      display_name: "Nuovo",
      keys: ["title", "label", "fields", "message"],
    },
    title: {
      type: "text",
      display_name: "Titolo",
    },
    label: {
      type: "text",
      display_name: "Azione",
    },
    fields: {
      type: "bloks",
      display_name: "Passaggi",
      restrict_components: true,
      component_whitelist: ["field"],
    },
    message: {
      type: "markdown",
      display_name: "Messaggio di successo",
      description: `Il messaggio di successo viene mostrato al termine del modulo.
\nNel testo potrai inserire {{nome del campo}} tra quelli inseriti.
\nElenco dei campi:
name, surname,fullname, birthday, gender, email, phone, country,
region, district, city, address, message, policy.`,
      customize_toolbar: true,
      rich_markdown: true,
      toolbar: [
        "h3",
        "h4",
        "h5",
        "h6",
        "bold",
        "italic",
        "paragraph",
        "list",
        "hrule",
        "link",
        "image",
        "inlinecode",
      ],
    },
    terms: {
      type: "text",
      display_name: "Collegamento termini e condizioni",
      description:
        "Inserendo il collegamento l'ultima verrà aggiunto il campo ho letto i termini e le condizioni",
      inline_label: true,
    },
  },
};

const nav: ComponentSchema = {
  name: "nav",
  display_name: "Navigatore",
  is_root: true,
  is_nestable: true,
  component_group_uuid: "containers",
  preview_tmpl: ``,
  schema: {
    contents: {
      type: "bloks",
      display_name: "Collegamenti",
      restrict_components: true,
      component_whitelist: ["action", "menu"],
      required: true,
    },
    message: {
      type: "markdown",
      display_name: "Messaggio",
      customize_toolbar: true,
      rich_markdown: true,
      toolbar: ["bold", "paragraph", "link", "inlinecode", "italic"],
    },
  },
};

const page: ComponentSchema = {
  name: "page",
  display_name: "Pagina",
  is_root: true,
  is_nestable: false,
  component_group_uuid: "layouts",
  preview_tmpl: ``,
  schema: {
    preview: {
      type: "section",
      display_name: "Anteprima metadati",
      keys: ["title", "description", "image"],
    },
    title: {
      type: "textarea",
      display_name: "Titolo",
      max_length: 80,
    },
    description: {
      type: "textarea",
      display_name: "Riassunto",
      max_length: 300,
    },
    image: {
      type: "asset",
      display_name: "Immagine",
      description: "Dimensione consigliata 1200x627px",
      filetypes: ["images"],
    },
    menu: {
      type: "section",
      display_name: "Menu pagina",
      keys: ["header", "footer"],
    },
    header: {
      type: "option",
      display_name: "Menu superiore",
      description: "Seleziona uno delle intestazioni o creane una nuova",
      source: "internal_stories",
      filter_content_type: ["nav"],
    },
    footer: {
      type: "option",
      display_name: "Menu inferiore",
      description: "Seleziona uno dei pie di pagina o creane uno nuovo",
      source: "internal_stories",
      filter_content_type: ["nav"],
    },
    body: {
      type: "bloks",
      display_name: "Contenuti pagina",
      restrict_components: true,
      component_whitelist: ["section", "carousel", "map", "aside"],
    },
  },
};

const article: ComponentSchema = {
  name: "article",
  display_name: "Articolo",
  is_root: true,
  is_nestable: true,
  component_group_uuid: "layouts",
  preview_tmpl: ``,
  schema: {
    alias: {
      type: "option",
      display_name: "Collega",
      source: "internal_stories",
      filter_content_type: ["article"],
    },
    new: {
      type: "section",
      display_name: "Nuovo",
      keys: ["title", "description", "image", "author", "body"],
    },
    title: {
      type: "textarea",
      display_name: "Titolo",
      max_length: 80,
    },
    description: {
      type: "textarea",
      display_name: "Riassunto",
      max_length: 300,
    },
    image: {
      type: "asset",
      display_name: "Immagine",
      description: "Dimensione consigliata 1200x627px",
      filetypes: ["images"],
    },
    author: {
      type: "option",
      display_name: "Autore",
      source: "internal_stories",
      filter_content_type: ["person"],
    },
    body: {
      type: "bloks",
      display_name: "Contenuti articolo",
      restrict_components: true,
      component_whitelist: ["section", "carousel", "aside"],
    },
  },
};

const location: ComponentSchema = {
  name: "location",
  display_name: "Località",
  is_root: true,
  is_nestable: true,
  component_group_uuid: "resources",
  preview_tmpl: ``,
  schema: {
    alias: {
      type: "option",
      display_name: "Collega",
      source: "internal_stories",
      filter_content_type: ["location"],
    },
    new: {
      type: "section",
      display_name: "Nuovo",
      keys: ["title", "address", "gps", "direction"],
    },
    title: {
      type: "text",
      display_name: "Nome",
    },
    address: {
      type: "textarea",
      display_name: "Indirizzo",
      description: `Via, Civico - cap\nCittà Provincia`,
    },
    gps: {
      type: "text",
      display_name: "Coordinate",
      description: "Latitudine/Longitudine",
    },
    direction: {
      type: "text",
      display_name: "Indicazioni",
    },
  },
};

const course: ComponentSchema = {
  name: "course",
  display_name: "Corso",
  is_root: true,
  is_nestable: true,
  component_group_uuid: "resources",
  preview_tmpl: ``,
  schema: {
    alias: {
      type: "option",
      display_name: "Collega",
      source: "internal_stories",
      filter_content_type: ["course"],
    },
    new: {
      type: "section",
      display_name: "Nuovo",
      keys: [
        "id",
        "title",
        "location",
        "days",
        "hours",
        "starts",
        "ends",
        "seats",
        "page",
      ],
    },
    id: {
      type: "text",
      display_name: "Id del corso",
      required: true,
      description: `[numero]-[sede]-[area]-[frequenza]\nEsempio: 01-treviso-interni-serale`,
      inline_label: true,
    },
    title: {
      type: "text",
      display_name: "Titolo",
    },
    location: {
      type: "option",
      display_name: "Sede",
      source: "internal_stories",
      filter_content_type: ["location"],
    },
    days: {
      type: "options",
      display_name: "Giorni di lezione",
      options: [
        { value: "Lunedì", name: "Lunedì" },
        { value: "Martedi", name: "Martedi" },
        { value: "Mercoledì", name: "Mercoledì" },
        { value: "Giovedì", name: "Giovedì" },
        { value: "Venerdì", name: "Venerdì" },
        { value: "Sabato", name: "Sabato" },
      ],
    },
    hours: {
      type: "options",
      display_name: "Orario delle lezioni",
      options: [
        { value: "9:00/12:00", name: "9:00/12:00" },
        { value: "13:00/16:00", name: "13:00/16:00" },
        { value: "20:00/23:00", name: "20:00/23:00" },
      ],
    },
    starts: {
      type: "datetime",
      display_name: "Data inizio",
      disable_time: true,
    },
    ends: {
      type: "datetime",
      display_name: "Data fine",
      disable_time: true,
    },
    seats: {
      type: "number",
      display_name: "Posti",
      description: "Numero massimo di posti",
      default_value: "12",
    },
    page: {
      type: "multilink",
      display_name: "Pagina",
      restrict_content_types: true,
      component_whitelist: ["page"],
    },
  },
};

const person: ComponentSchema = {
  name: "person",
  display_name: "Persona",
  is_root: true,
  is_nestable: true,
  component_group_uuid: "resources",
  preview_tmpl: ``,
  schema: {
    alias: {
      type: "option",
      display_name: "Collega",
      source: "internal_stories",
      filter_content_type: ["person"],
    },
    hide: {
      type: "option",
      display_name: "Nascondi",
      options: [
        { value: "video", name: "Video" },
        { value: "description", name: "Descrizione" },
        { value: "role", name: "Ruolo" },
        { value: "links", name: "Collegamenti" },
      ],
    },
    new: {
      type: "section",
      display_name: "Nuovo",
      keys: ["image", "video", "title", "role", "description", "links"],
    },
    image: {
      type: "multiasset",
      display_name: "Immagini",
      description: "Dimensione consigliata 500x500",
      filetypes: ["images"],
    },
    video: {
      type: "text",
      display_name: "Video",
      description: "id del video di youtube",
      tooltip: true,
    },
    title: {
      type: "text",
      display_name: "Nome Cognome",
    },
    role: {
      type: "option",
      display_name: "Ruolo",
      options: [
        { value: "interior", name: "Studente interni" },
        { value: "style", name: "Docente stile" },
        { value: "design", name: "Docente progettazione" },
        { value: "cad", name: "Docente software" },
        { value: "3d", name: "Docente modellazione" },
        { value: "building", name: "Docente cantieristica" },
        { value: "lighting", name: "Docente illuminotecnica" },
      ],
    },
    description: {
      type: "markdown",
      display_name: "Descrizione",
      customize_toolbar: true,
      rich_markdown: true,
      toolbar: ["bold", "italic", "paragraph", "quote", "inlinecode"],
      max_length: 240,
    },
    links: {
      type: "bloks",
      display_name: "Collegamenti",
      restrict_components: true,
      component_whitelist: ["action"],
      maximum: 3,
    },
  },
};

const event: ComponentSchema = {
  name: "event",
  display_name: "Evento",
  is_root: true,
  is_nestable: true,
  component_group_uuid: "resources",
  preview_tmpl: ``,
  schema: {
    alias: {
      type: "option",
      display_name: "Collega",
      source: "internal_stories",
      filter_content_type: ["event"],
    },
    new: {
      type: "section",
      display_name: "Nuovo",
      keys: ["title", "description", "openday", "location", "date", "page"],
    },
    title: {
      type: "text",
      display_name: "Titolo",
    },
    description: {
      type: "markdown",
      display_name: "Descrizione",
      customize_toolbar: true,
      rich_markdown: true,
      toolbar: [
        "bold",
        "paragraph",
        "list",
        "olist",
        "hrule",
        "link",
        "inlinecode",
      ],
      default_value: "",
    },
    openday: {
      type: "option",
      display_name: "Openday",
      options: [
        {
          value: "interni - primo livello",
          name: "Corso interni primo livello",
        },
        {
          value: "interni - secondo livello",
          name: "Corso interni secondo livello",
        },
        { value: "moda - primo livello", name: "Corso moda primo livello" },
        { value: "moda - secondo livello", name: "Corso moda secondo livello" },
      ],
    },
    location: {
      type: "option",
      display_name: "Sede",
      source: "internal_stories",
      filter_content_type: ["location"],
    },
    date: {
      type: "datetime",
      display_name: "Data",
    },
    page: {
      type: "multilink",
      display_name: "Pagina",
      restrict_content_types: true,
      component_whitelist: ["page"],
    },
    form: {
      type: "option",
      display_name: "Modulo",
      source: "internal_stories",
      restrict_content_types: true,
      filter_content_type: ["form"],
    },
  },
};

export type Components =
  | "action"
  | "text"
  | "image"
  | "background"
  | "gallery"
  | "video"
  | "field"
  | "menu"
  | "process"
  | "list"
  | "form"
  | "alias"
  | "aside"
  | "wrapper"
  | "carousel"
  | "map"
  | "section"
  | "nav"
  | "location"
  | "course"
  | "person"
  | "event"
  | "page"
  | "article";

export const components = {
  action,
  text,
  image,
  background,
  gallery,
  video,
  field,
  menu,
  process,
  list,
  alias,
  aside,
  wrapper,
  carousel,
  map,
  form,
  section,
  nav,
  page,
  article,
  location,
  course,
  person,
  event,
};

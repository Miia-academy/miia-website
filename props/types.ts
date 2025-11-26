export type StoryProps = {
  id: string;
  uuid: string;
  full_slug: string;
  name: string;
  tag_list: Array<string>;
  content: BlokProps;
};

export type BlokProps = {
  id: string;
  _uid: string;
  uuid: string;
};

export type EntryProps = {
  id: number;
  name: string;
  value: string;
};

export type RefProps = {
  content: StoryProps;
};

export type LinkProps = {
  cached_url: string;
  linktype: "story" | "url";
  url: string;
  target?: "_blank";
  anchor?: string;
};

export type ImageData = {
  filename: string;
  alt: string;
  title: string;
  source: string;
  copyright: string;
  focus: string;
};

export type ImageArray = ImageData & {
  id: number;
};

export type OptionProps = {
  name: string | (Omit<CourseProps, "location"> & { location: string });
  value: string | number;
};

// Props

export type Roles =
  | "interior"
  | "style"
  | "design"
  | "cad"
  | "3d"
  | "building"
  | "lighting";

export type Sizes = "small" | "medium" | "large" | "extra" | "full";

export type Justifications = "right" | "center" | "left";

type CourseDays =
  | "Lunedì"
  | "Martedì"
  | "Mercoledì"
  | "Giovedì"
  | "Venerdì"
  | "Sabato";

type CourseHours = "9:00/12:00" | "13:00/16:00" | "20:00/23:00";

export type FormList = Array<number>; //'studenti' | 'aziende' | 'clienti' | 'docenti'

export type FormArea = "interni" | "moda";

type InputTypes =
  | "text"
  | "number"
  | "email"
  | "tel"
  | "date"
  | "checkbox"
  | "area"
  | "select"
  | "multiple"
  | "hidden"
  | "enroll";

// Components Props

export type ComponentsProps =
  | ActionProps
  | TextProps
  | ImageProps
  | GalleryProps
  | FieldProps
  | ListProps
  | ProcessProps
  | MenuProps
  | AliasProps
  | WrapperProps
  | CarouselProps
  | MapProps
  | FormProps
  | SectionProps
  | NavProps
  | MetaProps
  | PageProps
  | ArticleProps
  | LocationProps
  | CourseProps
  | PersonProps
  | EventProps;

export type ActionProps = BlokProps & {
  component: "action";
  id: string;
  label: string;
  link: LinkProps;
  external: boolean;
  button: boolean;
  color: "primary" | "secondary";
};

export type TextProps = BlokProps & {
  component: "text";
  title: string;
  description: string;
  justify: Justifications;
  hide: "title" | "description" | "all";
  width: Array<"1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "1/1">;
  order: number;
  theme: "primary" | "secondary";
};

export type ImageProps = BlokProps & {
  component: "image";
  image: ImageData;
  fullScreen: boolean;
  aspect: "1/1" | "3/4" | "4/3" | "9/4" | "4/9";
  width: Array<"1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "1/1">;
  size: "sm" | "md" | "lg";
  order: number;
  author: PersonProps;
};

export type BackgroundProps = BlokProps & {
  component: "background";
  image: ImageData;
  video: string;
  position: Array<"right" | "center" | "left">;
  author: StoryProps & { content: PersonProps };
};

export type GalleryProps = BlokProps & {
  component: "gallery";
  images: Array<ImageArray>;
  fullScreen: boolean;
  aspect: "1/1" | "3/4" | "4/3";
  size: "1/2" | "1/4" | "1/8";
  width: Array<"1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "1/1">;
};

export type VideoProps = BlokProps & {
  component: "video";
  source: string;
  width: Array<"1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "1/1">;
  order: number;
};

export type FieldProps = BlokProps & {
  component: "field";
  id: string;
  input: InputTypes;
  label: string;
  placeholder: string;
  required: boolean;
  options: string | Array<OptionProps>;
  hidden?: boolean;
};

export type MenuProps = BlokProps & {
  component: "menu";
  title: string;
  links: Array<ActionProps>;
  inline: boolean;
};

export type ProcessProps = BlokProps & {
  component: "process";
  title: string;
  steps: Array<WrapperProps>;
};

export type ListProps = BlokProps & {
  component: "list";
  items: Array<TextProps>;
  size: "1/4" | "1/3" | "1/2" | "2/3" | "3/4";
};

export type AliasProps = BlokProps & {
  component: "alias";
  title: string;
  image: ImageData;
  resource: "next-event" | "last-article";
  filter: string;
  submit: Array<FormProps>;
};

export type AsideProps = BlokProps & {
  component: "aside";
  headline: string;
  amount: number;
  steps: number;
  discount: number;
  due_date: string;
  courses: Array<{
    content: Omit<CourseProps, "location"> & { location: string };
  }>;
  forms: Array<FormProps>;
  contents: Array<
    ImageProps | ListProps | TextProps | ActionProps | WrapperProps
  >;
  id: string;
  theme: "dark";
};

export type WrapperProps = BlokProps & {
  component: "wrapper";
  contents: (
    | ImageProps
    | VideoProps
    | TextProps
    | ActionProps
    | GalleryProps
    | BackgroundProps
    | ListProps
    | MenuProps
    | MapProps
    | CourseProps
    | PersonProps
    | EventProps
  )[];
  row: boolean;
  width: Array<"1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "1/1">;
  justify: Justifications;
  order: number;
};

export type CarouselProps = BlokProps & {
  component: "carousel";
  id: string;
  slides: Array<SectionProps | WrapperProps | PersonProps>;
  view: number;
  delay: number;
  order: number;
};

export type MapProps = BlokProps & {
  component: "map";
  locations: Array<StoryProps & { content: LocationProps }>;
};

export type SectionProps = BlokProps & {
  component: "section";
  contents: Array<
    | WrapperProps
    | BackgroundProps
    | ProcessProps
    | GalleryProps
    | ListProps
    | TextProps
    | ActionProps
    | CarouselProps
    | MapProps
    | AliasProps
    | LocationProps
    | PersonProps
    | EventProps
    | CourseProps
    | ArticleProps
    | FormProps
  >;
  id: string;
  dark: boolean;
  align: Array<"start" | "center" | "end" | "stretch">;
};

export type NavProps = BlokProps & {
  component: "nav";
  contents: Array<ActionProps | MenuProps | ListProps>;
  message: string;
};

export type MetaProps = {
  title: string;
  description: string;
  image: ImageData | undefined;
};

export type PageProps = BlokProps & {
  component: "page";
  title: string;
  description: string;
  image: ImageData;
  header: StoryProps & {
    content: NavProps;
  };
  footer: StoryProps & {
    content: NavProps;
  };
  body: Array<SectionProps | CarouselProps | MapProps | AsideProps>;
};

export type ArticleProps = BlokProps & {
  component: "article";
  alias: StoryProps & { content: ArticleProps };
  title: string | "";
  description: string | "";
  image: ImageData;
  author: StoryProps & {
    content: PersonProps;
  };

  body: Array<SectionProps | AsideProps>;
};

export type LocationProps = BlokProps & {
  component: "location";
  alias: StoryProps & { content: LocationProps };
  title: string;
  address: string;
  gps: string;
  direction: string;
};

export type CourseProps = BlokProps & {
  component: "course";
  alias: StoryProps & { content: CourseProps };
  id: string;
  title: string;
  location: LocationProps;
  days: Array<CourseDays>;
  hours: Array<CourseHours>;
  starts: string;
  ends: string;
  seats: number;
  page: LinkProps;
};

export type PersonData = {
  image: Array<ImageData> | [];
  video: string;
  title: string;
  role: Roles;
  description: string;
  links: Array<ActionProps> | [];
};

export type PersonProps = BlokProps &
  PersonData & {
    component: "person";
    alias: StoryProps & { content: PersonProps };
    hide: Array<string>;
  };

export type EventProps = BlokProps & {
  component: "event";
  alias: StoryProps & { content: EventProps };
  title: string;
  description: string;
  openday:
    | "interni - primo livello"
    | "interni - secondo livello"
    | "moda - primo livello"
    | "moda - secondo livello";
  location: LocationProps;
  date: string;
  page: LinkProps;
};

// Brevo and form props

export type FormProps = BlokProps & {
  component: "form";
  alias: StoryProps & { content: FormProps };
  list: FormList;
  title: string;
  label: string;
  fields: Array<FieldProps>;
  message: string;
  tracking: "enroll" | "lead" | "open_day" | string;
  terms?: string;
};

export type FormData_ = Record<string, FieldData>;
export type FieldData = DataProps;

export type FormData = {
  [key: string]: any;
};

export type DataProps = {
  id: string;
  value: any; //string | boolean | number | Date | Array<string>
  required: boolean;
  error: string | null;
};

export type BrevoProps = {
  email?: string;
  id?: number;
  emailBlacklisted?: boolean;
  smsBlacklisted?: boolean;
  createdAt?: Date;
  modifiedAt?: Date;
  updateEnabled?: boolean;
  listIds?: Array<number>;
  attributes: BrevoAttributes;
};

export type BrevoAttributes = {
  [key: string]: string | number | Date | Array<any>;
};

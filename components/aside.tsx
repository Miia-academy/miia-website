import type { Aside as AsideBlok } from "@types";
import { StoryblokComponent, storyblokEditable } from "@storyblok/react";
import { Accordion, AccordionItem } from "@heroui/react";
import { tv } from "tailwind-variants";
import { useIntersectionObserver } from "usehooks-ts";
import { getLongDate, getShortDate } from "@modules/formats";
import { useDataContext } from "@modules/context";

interface ListItemProps {
  label: string;
  icon: string;
  value?: string | number | null;
}

const ListItem = ({ label, icon, value }: ListItemProps) => {
  if (!value) return null;

  return (
    <li className="space-x-1">
      <i className={`iconoir-${icon} pr-1`} />
      <span className="md:max-lg:hidden">{label}</span>
      <span>{value}</span>
    </li>
  );
};

interface PriceProps {
  intersec: boolean;
  amount: number;
  steps: number | null;
  percent?: number;
  dueDate?: string;
  showDiscount?: boolean;
}

const Price = ({
  amount,
  steps,
  intersec,
  percent,
  dueDate,
  showDiscount,
}: PriceProps) => {
  const { container, price, discount, shape, date } = priceClasses();
  const formattedDueDate = dueDate ? getShortDate(dueDate) : null;

  return (
    <div className={container({ intersec })}>
      <div className={price({ intersec })}>
        {!!steps && <span className="text-xl lg:text-3xl">A partire da </span>}
        <span className="mx-1 font-serif text-3xl font-black leading-none lg:text-5xl">
          {amount}
          <small className="text-xl">€</small>
        </span>
        <span className="block">
          {!!steps && (
            <span className="mr-1 text-xl leading-none mlg:text-3xl">
              per {steps} mesi
            </span>
          )}
          <small className="italic">
            {" "}
            <sup>*</sup>iva inclusa
          </small>
        </span>
      </div>

      {showDiscount && !!percent && !!formattedDueDate && (
        <div className={discount({ intersec })}>
          <span className={shape()}>{percent}%</span>
          <span className={date({ intersec })}>
            per iscrizioni entro <br className="sm:max-md:hidden" />
            {formattedDueDate}
          </span>
        </div>
      )}
    </div>
  );
};

interface AsideComponentProps {
  blok: AsideBlok;
}

export default function Aside({ blok }: AsideComponentProps) {
  // 🎯 1. Estraiamo le location dal Context globale (senza passare props dall'alto!)
  const { locations } = useDataContext();

  // 2. Parsing dei valori numerici
  const amount = blok.amount ? parseFloat(blok.amount) : 100;
  const steps = blok.steps ? parseInt(blok.steps, 10) : null;
  const discountPercent = blok.discount ? parseFloat(blok.discount) : undefined;

  // 3. Controllo logico Sconto
  const showDiscount = Boolean(
    blok.due_date && new Date() < new Date(blok.due_date)
  );

  // 4. Elaborazione opzioni form e mappatura corsi
  const formOptions: Array<{ name: string; value: string }> = [];

  const rawCourses = Array.isArray(blok.courses) ? blok.courses : [];
  const courses = rawCourses.map((courseItem: any) => {
    // Gestisce sia il caso in cui courseItem sia la story risolta da Storyblok, sia il caso in cui sia l'oggetto diretto
    const content = courseItem.content || courseItem || {};

    if (content.title) {
      formOptions.push({
        name: content.title,
        value: content.id || content.title,
      });
    }

    // Troviamo la location dall'array in memoria preso dal Context
    const matchedLocation = locations.find(
      (loc) => loc.uuid === content.location || loc.uuid === (content.location as any)?.uuid
    );

    return {
      _uid: courseItem._uid || content._uid || Math.random().toString(),
      title: content.title || "",
      days: Array.isArray(content.days) ? content.days : [],
      hours: Array.isArray(content.hours) ? content.hours.join(", ") : null,
      starts: content.starts ? getLongDate(content.starts) : "in programmazione",
      ends: content.ends ? getShortDate(content.ends) : null,
      seats: content.seats || null,
      location: matchedLocation,
    };
  });

  // 5. Estrattori array contents e forms
  const contents = Array.isArray(blok.contents) ? blok.contents : [];
  const forms = Array.isArray(blok.forms) ? blok.forms : [];

  // 6. Observer Intersezione (Sticky Banner)
  const { isIntersecting, ref } = useIntersectionObserver({ threshold: 0 });
  const isStickyBanner = !isIntersecting;

  return (
    <section
      id={blok.id}
      className={sectionClasses({ theme: blok.theme || undefined })}
      {...storyblokEditable(blok as any)}
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-3 p-6">
        {/* Lista Contenuti */}
        {contents.length > 0 && (
          <div className="order-last col-span-full space-y-4 md:order-1 md:col-span-8 md:space-y-6">
            {contents.map((content) => (
              <StoryblokComponent
                blok={content}
                parent={content.component}
                key={content._uid}
                theme={blok.theme || "light"}
              />
            ))}
          </div>
        )}

        {/* Aside / Sticky Banner */}
        <aside ref={ref} className={asideClasses()}>
          <div className={bannerClasses({ active: isStickyBanner })}>
            <div className={containerClasses({ active: isStickyBanner })}>
              <Price
                amount={amount}
                steps={steps}
                intersec={isStickyBanner}
                percent={discountPercent}
                dueDate={blok.due_date}
                showDiscount={showDiscount}
              />

              {/* Accordion Corsi */}
              {courses.length > 0 && (
                <div className={isStickyBanner ? "hidden" : "w-full"}>
                  <Accordion
                    selectionMode="multiple"
                    defaultExpandedKeys={courses.length === 1 ? ["0"] : []}
                  >
                    {courses.map((course) => (
                      <AccordionItem
                        key={course._uid}
                        HeadingComponent="h4"
                        title={course.title}
                        subtitle={
                          course.days.length > 0
                            ? `Frequenza ${course.days.join(" e ")}`
                            : undefined
                        }
                        classNames={{ title: "font-bold lg:text-lg" }}
                      >
                        <ul className="space-y-1 text-sm">
                          <ListItem
                            label="orari:"
                            icon="clock"
                            value={course.hours}
                          />
                          <ListItem
                            label="inizio:"
                            icon="calendar-arrow-up"
                            value={course.starts}
                          />
                          <ListItem
                            label="fine:"
                            icon="calendar-arrow-down"
                            value={course.ends}
                          />
                          <ListItem
                            label="posti rimasti:"
                            icon="group"
                            value={course.seats}
                          />
                        </ul>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {/* Form Blocchi Storyblok */}
              {forms.map((form, index) => {
                // Nasconde le form secondarie quando la barra diventa sticky in basso
                if (index > 0 && isStickyBanner) return null;

                return (
                  <StoryblokComponent
                    key={form._uid}
                    blok={form}
                    variant={index === 0 ? "solid" : "ghost"}
                    courses={formOptions} // 👈 Passiamo le opzioni form formattate al componente Form
                  />
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

// Styles con tailwind-variants...
const priceClasses = tv({
  slots: {
    container: "relative flex flex-1 flex-col w-full",
    price: "flex-1 font-serif font-semibold min-w-[216px]",
    discount: "flex flex-1 items-center gap-2 font-bold text-secondary",
    shape:
      "inline-block shrink-0 py-3 w-12 h-12 text-center text-background bg-[url(/discount.png)] bg-no-repeat bg-contain",
    date: "text-sm leading-tight",
  },
  variants: {
    intersec: {
      false: {
        discount: "-mb-2 mt-1 sm:-ml-4",
      },
      true: {
        container: "flex-row flex-wrap gap-2 text-foreground sm:min-w-[420px]",
        price: "text-right text-background",
        discount: "absolute sm:relative",
        date: "hidden sm:inline-block",
      },
    },
  },
});

const sectionClasses = tv({
  base: "min-h-12 py-6 sm:py-8 md:py-10 lg:py-12",
  variants: {
    theme: {
      dark: "dark bg-background text-foreground",
    },
  },
});

const asideClasses = tv({
  base: "sticky z-30 order-1 col-span-full max-h-fit self-start sm:-mt-32 sm:col-span-8 md:top-20 md:order-last md:col-span-4",
});

const bannerClasses = tv({
  base: "-bottom-full",
  variants: {
    active: {
      true: "fixed bottom-0 left-0 right-0 bg-foreground text-background transition-all",
      false:
        "flex flex-col items-start justify-start rounded-3xl bg-background p-2 text-foreground shadow-aside transition-all",
    },
  },
});

const containerClasses = tv({
  base: "flex justify-center",
  variants: {
    active: {
      true: "mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-1 px-6 py-1 sm:gap-1.5 sm:py-1.5 md:gap-2 md:py-2 lg:gap-3 lg:py-3 [&_button]:w-full [&_button]:sm:w-auto [&_button]:sm:min-w-64",
      false: "flex-col gap-3 pb-1",
    },
  },
});
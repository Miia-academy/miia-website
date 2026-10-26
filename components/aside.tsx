import type { Aside as AsideBlok } from "@types";
import { StoryblokComponent, storyblokEditable } from "@storyblok/react";
import { Accordion, AccordionItem } from "@heroui/react";
import { Button } from "@components/ui/button";
import { tv } from "tailwind-variants";
import { useIntersectionObserver } from "usehooks-ts";
import { getLongDate, getShortDate } from "@modules/formats";
import { useDataContext } from "@modules/context";
import { useMemo, type ReactNode } from "react";
import { editionKey, seatsLabel, useSignedCounts } from "@components/enrollment/use-seats";
import { actionHref, canEnroll, enrollHref, isEnrollAction, isEnrollForm, mainEnrollHref } from "@components/enrollment/enroll-link";
import Link from "next/link";
import { DEFAULT_PRICE_TEXT, fillPriceText, filterEditions, priceSegments } from "@modules/aside";

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
  const { container, price, from, figure, line, period } = priceClasses();

  return (
    <div className={container({ intersec })}>
      <div className={price({ intersec })}>
        {!!steps && <span className={from({ intersec })}>A partire da </span>}
        <span className={figure({ intersec })}>
          {amount}
          <small className="text-xl">€</small>
        </span>
        <span className={line({ intersec })}>
          {!!steps && (
            <span className={period({ intersec })}>
              per {steps} mesi
            </span>
          )}
          <small className="italic">
            {" "}
            <sup>*</sup>iva inclusa
          </small>
        </span>
      </div>

      {showDiscount && <Discount intersec={intersec} percent={percent} dueDate={dueDate} />}
    </div>
  );
};

const Discount = ({ intersec, percent, dueDate }: { intersec: boolean; percent?: number; dueDate?: string }) => {
  const { discount, shape, date } = priceClasses();
  const formattedDueDate = dueDate ? getShortDate(dueDate) : null;
  if (!percent || !formattedDueDate) return null;
  return (
    <div className={discount({ intersec })}>
      <span className={shape()}>{percent}%</span>
      <span className={date({ intersec })}>
        per iscrizioni entro <br className="sm:max-md:hidden" />
        {formattedDueDate}
      </span>
    </div>
  );
};

interface AsideComponentProps {
  blok: AsideBlok;
}

/** Price headline from the "Titolo prezzo" text, e.g. "A partire da **{rata10}€** per 10 mesi _*iva inclusa_". */
const PriceText = ({ text, intersec, discount }: { text: string; intersec: boolean; discount: ReactNode }) => {
  const { container, price, figure, period } = priceClasses();
  return (
    <div className={container({ intersec })}>
      <p className={price({ intersec })}>
        {priceSegments(text).map((segment, i) =>
          segment.kind === "figure" ? (
            <span key={i} className={figure({ intersec })}>{segment.value}</span>
          ) : segment.kind === "note" ? (
            <small key={i} className="italic">{segment.value}</small>
          ) : (
            <span key={i} className={period({ intersec })}>{segment.value}</span>
          )
        )}
      </p>
      {discount}
    </div>
  );
};

export default function Aside({ blok }: AsideComponentProps) {
  const { locations, courses: allEditions, prices } = useDataContext();
  // Pages still with the hand-typed price keep it until the switch to main;
  // without it the headline comes from the price list.
  const priceText = fillPriceText(
    blok.price_text?.trim() ? blok.price_text : blok.amount ? undefined : DEFAULT_PRICE_TEXT,
    prices
  );

  const amount = blok.amount ? parseFloat(blok.amount) : 100;
  const steps = blok.steps ? parseInt(blok.steps, 10) : null;
  const discountPercent = blok.discount ? parseFloat(blok.discount) : undefined;

  const showDiscount = Boolean(
    blok.due_date && new Date() < new Date(blok.due_date)
  );

  const { courses, formOptions } = useMemo(() => {
    const opts: Array<{ name: string; value: string }> = [];
    // With the "Filtro edizioni" the editions come from the site data (only the
    // published ones on the live site); otherwise from the ones picked by hand.
    const rawCourses = blok.filter?.trim()
      ? filterEditions(allEditions, blok.filter).map((c) => ({ uuid: c.uuid, full_slug: c.fullSlug, content: c }))
      : Array.isArray(blok.courses) ? blok.courses : [];

    const crs = rawCourses.map((courseItem: any) => {
      const content = courseItem.content || courseItem || {};

      if (content.title) {
        opts.push({
          name: content.title,
          value: content.id || content.title,
        });
      }

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
        key: editionKey(courseItem.uuid || "", content.starts),
        fullSlug: typeof courseItem.full_slug === "string" ? courseItem.full_slug : null,
        location: matchedLocation,
      };
    });

    return { courses: crs, formOptions: opts };
  }, [blok.courses, blok.filter, allEditions, locations]);

  const signed = useSignedCounts(courses.map((c) => c.key));
  // Con l'iscrizione online accesa e posti liberi, il pulsante "Iscriviti online"
  // prende il posto del modulo di richiesta iscrizione (tracking "enroll").
  const enrollMain = mainEnrollHref(courses, signed);

  const contents = Array.isArray(blok.contents) ? blok.contents : [];
  // Hidden items are dropped first, so the first visible one is the main button
  // and the one kept in the sticky bar. The enrollment action (/iscrizione/<course>)
  // shows only with online enrollment on and seats left; before the Storyblok
  // migration the enrollment request form is hidden when seats are over.
  const visibleForms = (Array.isArray(blok.forms) ? blok.forms : []).filter((form) =>
    form.component === "action"
      ? !!actionHref(form) && !(isEnrollAction(form) && !enrollMain)
      : !(isEnrollForm(form) && signed !== null && !enrollMain)
  );

  const { isIntersecting, ref } = useIntersectionObserver({ threshold: 0 });
  const isStickyBanner = !isIntersecting;

  return (
    <section
      id={blok.id}
      className={sectionClasses({ theme: blok.theme || undefined })}
      {...storyblokEditable(blok as any)}
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-3 p-6">
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

        <aside ref={ref} className={asideClasses()}>
          <div className={bannerClasses({ active: isStickyBanner })}>
            <div className={containerClasses({ active: isStickyBanner })}>
              {priceText ? (
                <PriceText
                  text={priceText}
                  intersec={isStickyBanner}
                  discount={
                    showDiscount && (
                      <Discount intersec={isStickyBanner} percent={discountPercent} dueDate={blok.due_date} />
                    )
                  }
                />
              ) : (
                <Price
                  amount={amount}
                  steps={steps}
                  intersec={isStickyBanner}
                  percent={discountPercent}
                  dueDate={blok.due_date}
                  showDiscount={showDiscount}
                />
              )}

              {courses.length > 0 && (
                <div className={isStickyBanner ? "hidden" : "w-full"}>
                  <Accordion
                    selectionMode="single"
                    defaultExpandedKeys={courses.length === 1 ? ["0"] : []}
                  >
                    {courses.map((course, index) => (
                      <AccordionItem
                        key={index.toString()}
                        HeadingComponent="h4"
                        title={course.title}
                        subtitle={
                          <ul className="text-sm list-none">
                            {course.days.length > 0 && (
                              <li>Frequenza: {course.days.join(" e ")}</li>
                            )}
                            {course.seats && (
                              <li>Posti rimasti: {seatsLabel(course.seats, course.key, signed)}</li>
                            )}
                          </ul>
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
                        </ul>
                        {(() => {
                          const href =
                            course.key && canEnroll(signed, seatsLabel(course.seats, course.key, signed))
                              ? enrollHref(course.fullSlug, course.key)
                              : null;
                          return href ? (
                            <Button
                              as={Link}
                              href={href}
                              size="md"
                              color="primary"
                              className="mt-3 mb-1 w-full text-medium"
                            >
                              Iscriviti online a questa edizione
                            </Button>
                          ) : null;
                        })()}
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {visibleForms.map((form, index) => {
                // Buttons in the aside are Storyblok actions
                if (form.component === "action") {
                  const href = actionHref(form) as string;
                  return (
                    <div
                      key={form._uid}
                      className={!isStickyBanner ? "w-full" : index > 0 ? "hidden" : "w-full sm:w-auto"}
                      {...storyblokEditable(form as any)}
                    >
                      <Button
                        as={Link}
                        href={href}
                        size="md"
                        color="primary"
                        variant={index === 0 ? "solid" : "ghost"}
                        className="w-full text-medium"
                      >
                        {form.label || "Iscriviti online"}
                      </Button>
                    </div>
                  );
                }
                // Before the Storyblok migration: with online enrollment on the enrollment
                // request form is replaced by the button.
                const enrollForm = isEnrollForm(form);
                return (
                  <div
                    key={form._uid}
                    className={!isStickyBanner ? "w-full" : index > 0 ? "hidden" : "w-full sm:w-auto"}
                  >
                    {enrollMain && enrollForm ? (
                      <Button
                        as={Link}
                        href={enrollMain}
                        size="md"
                        color="primary"
                        variant={index === 0 ? "solid" : "ghost"}
                        className="w-full text-medium"
                      >
                        Iscriviti online
                      </Button>
                    ) : (
                      <StoryblokComponent
                        blok={form}
                        variant={index === 0 ? "solid" : "ghost"}
                        courses={formOptions}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

const priceClasses = tv({
  slots: {
    container: "relative flex flex-1 flex-col w-full",
    price: "flex-1 font-serif font-semibold min-w-[216px]",
    from: "text-xl lg:text-3xl",
    figure: "mx-1 font-serif text-3xl font-black leading-none lg:text-5xl",
    line: "block",
    period: "mr-1 text-xl leading-none lg:text-3xl",
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
        // On phones the bottom bar shows the price on a single line
        price: "text-center text-background max-sm:whitespace-nowrap sm:text-right",
        from: "max-sm:text-base max-[359px]:text-sm",
        figure: "max-sm:text-2xl max-[359px]:text-xl",
        line: "max-sm:inline",
        period: "max-sm:text-base max-[359px]:text-sm",
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
        "flex flex-col justify-start rounded-3xl bg-background p-2 text-foreground shadow-aside transition-all",
    },
  },
});

const containerClasses = tv({
  base: "flex justify-center",
  variants: {
    active: {
      true: "mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-1 px-6 pt-2 pb-6 max-[359px]:px-4 sm:gap-1.5 sm:py-1.5 md:gap-2 md:py-2 lg:gap-3 lg:py-3 [&_button]:w-full [&_button]:sm:w-auto [&_button]:sm:min-w-64",
      // Content and buttons span the whole box
      false: "w-full flex-col gap-3 pb-1 [&_button]:w-full",
    },
  },
});
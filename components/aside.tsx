import type { AsideProps } from "@props/types";
import type { LocationProps, OptionProps } from "@props/types";
import { tv } from "tailwind-variants";
import { StoryblokComponent, storyblokEditable } from "@storyblok/react";
import { Accordion, AccordionItem } from "@heroui/react";
import { getLongDate, getShortDate } from "@modules/formats";
import { useIntersectionObserver } from "usehooks-ts";

interface AsideComponent {
  blok: AsideProps;
  locations: Array<LocationProps>;
}

interface ListItemComponent {
  label: string;
  icon: string;
  value: string | number | null;
}

const ListItem = ({ label, icon, value }: ListItemComponent) =>
  !!value && (
    <li className="space-x-1">
      <i className={`iconoir-${icon} pr-1`} />
      <span className="md:max-lg:hidden">{label}</span>
      <span>{value}</span>
    </li>
  );

interface PriceComponent {
  intersec: boolean;
  amount: number;
  steps: number | null;
  percent?: number;
  due_date?: string;
  showDiscount?: boolean;
}

const Price = ({
  amount,
  steps,
  intersec,
  percent,
  due_date,
  showDiscount,
}: PriceComponent) => {
  const { container, price, discount, shape, date } = priceClasses();
  return (
    <h2 className={container({ intersec })}>
      <p className={price({ intersec })}>
        {!!steps && <span className="text-xl lg:text-3xl">A partire da </span>}
        <span className="font-black text-3xl lg:text-5xl leading-none mx-1">
          {amount}
          <small className="text-xl">€</small>
        </span>
        <span className="block">
          {!!steps && (
            <span className="text-xl mlg:text-3xl leading-none mr-1">
              per {steps} mesi
            </span>
          )}
          <small className="italic">
            {" "}
            <sup>*</sup>iva inclusa
          </small>
        </span>
      </p>
      {!!percent && !!due_date && showDiscount && (
        <p className={discount({ intersec })}>
          <span className={shape()}>{percent}%</span>
          <span className={date({ intersec })}>
            per iscrizioni entro <br className="sm:max-md:hidden" />
            {getShortDate(due_date)}
          </span>
        </p>
      )}
    </h2>
  );
};
const priceClasses = tv({
  slots: {
    container: "flex-1 flex flex-col w-full relative",
    price: "flex-1 min-w-[216px] font-serif font-semibold",
    discount: "flex-1 font-bold flex items-center gap-2 text-secondary",
    shape:
      "inline-block text-center shrink-0 py-3 w-12 h-12 text-background bg-[url(/discount.png)] bg-no-repeat bg-contain",
    date: "text-sm leading-tight ",
  },
  variants: {
    intersec: {
      false: {
        discount: "sm:-ml-4 mt-1 -mb-2",
      },
      true: {
        container: "flex-row gap-2 text-foreground flex-wrap sm:min-w-[420px]",
        price: "text-background text-right",
        discount: "absolute sm:relative",
        date: "hidden sm:inline-block",
      },
    },
  },
});

export default function Aside({ blok, locations }: AsideComponent) {
  const options: Array<OptionProps> = [];
  const courses =
    blok.courses.length > 0 &&
    blok.courses.map(({ content }) => {
      content?.title &&
        options.push({
          name: content,
          value: content.id,
        });
      const location =
        locations[
          locations.findIndex((location) => location.uuid === content.location)
        ];
      const starts = content?.starts && getLongDate(content.starts);
      const ends = content?.ends && getShortDate(content.ends);
      return { ...content, location, starts, ends };
    });

  const showDiscount = new Date() < new Date(blok.due_date);

  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0,
  });

  return (
    <section
      id={blok.id}
      className={sectionClasses({ theme: blok.theme })}
      {...storyblokEditable(blok)}
    >
      <div className="grid grid-cols-12 gap-3 p-6 mx-auto max-w-[1280px]">
        {!!blok.contents.length && (
          <div className="order-last md:order-1 col-span-full md:col-span-8 space-y-4 md:space-y-6">
            {!!blok.contents.length &&
              blok.contents.map((content, index) => (
                <StoryblokComponent
                  blok={content}
                  parent={content.component}
                  key={index}
                  theme={blok.theme || "light"}
                />
              ))}
          </div>
        )}
        <aside ref={ref} className={asideClasses()}>
          <div
            className={bannerClasses({
              active: !isIntersecting,
            })}
          >
            <div className={containerClasses({ active: !isIntersecting })}>
              <Price
                amount={blok.amount || 100}
                steps={blok.steps}
                intersec={!isIntersecting}
                percent={blok.discount}
                due_date={blok.due_date}
                showDiscount={showDiscount}
              />
              {!!courses && (
                <div className={!isIntersecting ? "hidden" : ""}>
                  <Accordion
                    selectionMode="multiple"
                    defaultExpandedKeys={courses.length === 1 ? ["0"] : []}
                  >
                    {courses.map((course, index) => (
                      <AccordionItem
                        key={index}
                        HeadingComponent="h4"
                        title={course.title}
                        subtitle={"Frequenza " + course.days.join(" e ")}
                        classNames={{ title: "font-bold lg:text-lg" }}
                      >
                        <ul className="text-sm space-y-1">
                          <ListItem
                            label="orari:"
                            icon="clock"
                            value={
                              course.hours ? course.hours.join(", ") : null
                            }
                          />
                          <ListItem
                            label="inizio:"
                            icon="calendar-arrow-up"
                            value={course.starts || "in programmazione"}
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
              {!!blok.forms &&
                blok.forms.map((form, index) => {
                  if (!!index && !isIntersecting) return null;
                  return (
                    <StoryblokComponent
                      key={index}
                      blok={form}
                      variant={!index ? "solid" : "ghost"}
                      courses={options}
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

const sectionClasses = tv({
  base: "py-6 sm:py-8 md:py-10 lg:py-12 min-h-12",
  variants: {
    theme: {
      dark: "dark text-foreground bg-background",
    },
  },
});

const asideClasses = tv({
  base: "sticky z-30 md:top-20 col-span-full sm:col-span-8 md:col-span-4 sm:-mt-32 order-1 md:order-last max-h-fit self-start",
});

const bannerClasses = tv({
  base: "-bottom-full",
  variants: {
    active: {
      true: "fixed right-0 left-0 bottom-0 transition-all bg-foreground text-background",
      false:
        "flex flex-col align-start justify-start rounded-3xl bg-background text-foreground p-2 shadow-aside transition-all",
    },
  },
});

const containerClasses = tv({
  base: "flex justify-center",
  variants: {
    active: {
      true: "px-6 py-1 sm:py-1.5 md:py-2 lg:py-3 flex-wrap items-center w-full mx-auto max-w-[1280px] gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 [&_button]:w-full [&_button]:sm:w-auto [&_button]:sm:min-w-64",
      false: "flex-col gap-3 pb-1",
    },
  },
});

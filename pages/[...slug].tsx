import type { LocationProps, EventProps } from "@props/types";
import { storyblokApi } from "@modules/storyblokApi";
import type { BlokProps } from "@props/types";
import {
  ISbStoryData,
  useStoryblokState,
  StoryblokComponent,
} from "@storyblok/react";

const excluding_slugs = ["home", "splash", "blog/"];

const relations = [
  "page.header",
  "page.footer",
  "aside.courses",
  "aside.enroll",
  "aside.contact",
  "course.location",
  "form.alias",
  "article.alias",
  "article.author",
  "person.alias",
  "course.alias",
  "event.alias",
  "event.form",
  "location.alias",
  "alias.form",
  "map.locations",
  "background.author",
];

type PageStory = {
  story: ISbStoryData & {
    id: string;
    content: BlokProps;
  };
  locations: Array<{
    content: LocationProps;
  }>;
  events: Array<{
    content: EventProps;
    name: string;
  }>;
};

export interface Opendays {
  fashion: Array<EventProps>;
  interior: Array<EventProps>;
}

export const opendays: Opendays = {
  fashion: [],
  interior: [],
};

export default function PageStory({ story, locations, events }: PageStory) {
  const page = useStoryblokState(story, {
    resolveRelations: relations,
    preventClicks: true,
  });
  if (!page) return null;

  events.forEach((event) => {
    if (event.name.startsWith("openday-interni")) {
      opendays.interior.push(event.content);
    } else if (event.name.startsWith("openday-moda")) {
      opendays.fashion.push(event.content);
    }
  });

  return (
    <StoryblokComponent
      locations={locations}
      events={events}
      blok={page.content}
    />
  );
}

export async function getStaticProps({ params, preview }: any) {
  let slug = `/${params.slug.join("/")}`;

  const variables = { slug, relations: relations.join(",") };
  const query = `
    query ($slug: ID!, $relations: String) {
      ContentNode(
        id: $slug,
        resolve_relations: $relations
      ) {
        id
        slug
        content
        first_published_at
        tag_list
      }
      EventItems(
        sort_by:"content.date:cres",
        per_page:100
      ) {
        items {
          content {
            date
          }
        name
        }
      }
      LocationItems {
        items {
          content {
            address
            direction
            gps
            title
          }
          uuid
        }
      }
    }
  `;
  const data = await storyblokApi({ query, variables });

  return {
    props: {
      story: data?.ContentNode || null,
      locations: data?.LocationItems.items || null,
      events: data?.EventItems.items || null,
    },
    revalidate: 3600,
  };
}

export async function getStaticPaths() {
  const variables = { excluding_slugs: excluding_slugs.join(",") };
  const query = `
    query ($excluding_slugs: String) {
      ContentNodes(
        excluding_slugs: $excluding_slugs,
        filter_query: {
          component: {
            in: "page,enroll"
          }
        }
      ) {
        items {
          full_slug
        }
      }
    }
  `;
  const slugs = await storyblokApi({ query, variables });
  const paths: Array<string> = slugs.ContentNodes.items.map(
    ({ full_slug }: { full_slug: string }) => `/${full_slug}`
  );

  return {
    paths: paths,
    fallback: "blocking",
  };
}

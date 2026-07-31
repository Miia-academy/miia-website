import { storyblokApi } from '@modules/storyblokApi'

export type CachedDataProps = {
  coures: any[]
  events: any[]
  locations: any[]
  articles: any[]
  jobs: any[]
} | null

let cachedData: CachedDataProps = null

export async function getCachedData() {
  // Se i dati sono già in memoria durante la stessa sessione di build, riutilizzali!
  if (cachedData) return cachedData

  const query = `
    query GlobalData {
      CourseItems {
        items {
          content {
            title
            starts
            seats
            page {
              cachedUrl
            }
            location {
              content
            }
            hours
            ends
            days
            component
            alias {
              content
            }
          }
          uuid
          full_slug
        }
      }
      EventItems(sort_by:"content.date:cres") {
        items {
          content {
            title
            page {
              cachedUrl
            }
            openday
            location {
              content
            }
            description
            date
            alias {
              content
            }
          }
          uuid
        }
      }
      ArticleItems(sort_by:"content.date:cres", per_page:100) {
        items {
          created_at
          full_slug
          name
          slug
          sort_by_date
          uuid
          content {
            title
            hidden
            description
            image {
              id
              filename
              alt
            }
            component
            body
            author {
              content
            }
            alias {
              content
            }
          }
        }
      } 
      JobItems(sort_by:"content.date:cres", per_page:100) {
        items {
          uuid
          tag_list
          full_slug
          content {
            area
            business
            company
            description
            location
            logo {
              filename
              alt
            }
            title
          }
        }
        total
      }
      LocationItems {
        items {
          content {
            title
            gps
            direction
            alias {
              content
            }
            address
          }
        }
      }
    }
  `

  const data = await storyblokApi({ query })

  cachedData = {
    coures: data?.CourseItems.items || [],
    events: data?.EventItems?.items || [],
    locations: data?.LocationItems?.items || [],
    articles: data?.ArticleItems?.items || [],
    jobs: data?.JobItems?.items || [],
  }

  return cachedData
}
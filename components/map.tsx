import type { Map as MapBlok, Location as LocationBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import { Map as MapGl, Marker, NavigationControl } from 'react-map-gl'
import { storyblokEditable } from '@storyblok/react'
import { isStoryResolved } from '@modules/relations'

interface MapComponentProps {
  blok: MapBlok
  contain?: boolean
  theme?: 'dark' | 'light'
}

// Interfaccia interna per tipizzare i dati parsati e ripuliti
interface ParsedLocation {
  id: string
  lat: number
  lng: number
}

export default function Map({ blok, contain, theme }: MapComponentProps) {
  const rawLocations = blok.locations || []

  // 1. Parsing sicuro e Type Narrowing delle locations in Strict Mode
  const locations: ParsedLocation[] = rawLocations
    .map((loc) => {
      // Type guard: esclude stringhe UUID e null/undefined
      if (!isStoryResolved<LocationBlok>(loc)) {
        return null
      }

      // Assicuriamo a TypeScript che a questo punto 'loc' è la Story risolta
      const resolvedLoc = loc as ISbStoryData<LocationBlok>
      const content = resolvedLoc.content

      if (!content.gps) return null

      // Dividiamo la stringa delle coordinate
      const parts = content.gps.split('/')
      if (parts.length !== 2) return null

      // Convertiamo in numeri interi/decimali
      const lat = parseFloat(parts[0])
      const lng = parseFloat(parts[1])

      // Se non sono numeri validi, scartiamo la location
      if (isNaN(lat) || isNaN(lng)) return null

      return {
        // resolvedLoc.uuid appartiene alla Story, content._uid appartiene al Blok
        id: resolvedLoc.uuid || content._uid || Math.random().toString(),
        lat,
        lng,
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  // 2. Early return per prevenire la divisione per zero in react-map-gl
  if (locations.length === 0) return null

  // 3. Calcolo dinamico del centro della mappa in base ai marker
  const latitude =
    locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length

  const longitude =
    locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length

  const initialView = {
    longitude,
    latitude,
    zoom: locations.length === 1 ? 14 : 7,
    bearing: 0,
    pitch: 0,
  }

  // 4. Gestione Layout
  const Tag = contain ? 'section' : 'div'
  const classes = contain ? 'min-h-md' : 'flex-1 w-full h-full min-h-96'

  return (
    <Tag className={classes} {...storyblokEditable(blok as any)}>
      <MapGl
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        style={{ width: 'inherit', height: 'inherit', minHeight: 'inherit' }}
        mapStyle={
          theme === 'dark'
            ? 'mapbox://styles/mapbox/dark-v9'
            : 'mapbox://styles/mapbox/light-v11'
        }
        initialViewState={initialView}
        maxZoom={17.5}
        minZoom={5.75}
        scrollZoom={false}
      >
        {locations.map((location) => (
          <Marker
            latitude={location.lat}
            longitude={location.lng}
            anchor="bottom"
            key={location.id}
          />
        ))}
        <NavigationControl />
      </MapGl>
    </Tag>
  )
}
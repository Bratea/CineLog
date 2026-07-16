export type MovieId = number | string

export interface PersonCredit {
  id?: MovieId
  name: string
  role?: string
  character?: string
  job?: string
  profile_path?: string | null
  profileUrl?: string
  birthday?: string
  placeOfBirth?: string
  biography?: string
  detailState?: 'idle' | 'loading' | 'ready' | 'error'
  knownFor?: Array<{
    id: MovieId
    title: string
    year?: string
    poster?: string
  }>
}

export interface Movie {
  id: MovieId
  title: string
  originalTitle?: string
  original_title?: string
  meta?: string
  year?: string
  rating?: number | null
  personalRating?: number | null
  tmdbRating?: number | null
  vote_average?: number | null
  vote_count?: number
  watched: boolean
  favourite?: boolean
  poster?: string
  posterText?: string
  poster_path?: string | null
  backdrop_path?: string | null
  posterUrl?: string
  backdropUrl?: string
  overview?: string
  feeling?: string
  review?: string
  tagline?: string
  releaseDate?: string
  release_date?: string
  recordDate?: string
  watchedDate?: string
  runtime?: number | null
  genres?: Array<string | { id?: number; name: string }>
  director?: PersonCredit
  cast?: PersonCredit[]
  posters?: Array<{ file_path: string; language?: string | null }>
  videos?: Array<{ id: MovieId; name: string; type?: string; official?: boolean; url: string }>
  [key: string]: any
}

export interface CategoryChild {
  id: string
  label: string
  source?: string
}

export interface Category {
  id: string
  label: string
  source?: string
  children: CategoryChild[]
}

export interface DetailLayoutModule {
  id: string
  label: string
  description: string
  tone: string
}

export interface DatabaseInfo {
  status: 'connected' | 'error'
  platform: string
  engine: string
  name: string
  version: number
  containerLabel: string
  containerName: string
  encryption: string
  stateEntries: number
  movieRecords: number
  updatedAt: number | null
  storageUsage: number
  storageQuota: number
}

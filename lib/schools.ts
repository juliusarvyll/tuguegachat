// School data model with logos
export interface School {
  id: string
  name: string
  logo: string // Image URL
  color: string
}

export const SCHOOLS: School[] = [
  {
    id: 'spup',
    name: 'St. Paul University Philippines',
    logo: '/logos/spup.png',
    color: '#A51C30'
  },
  {
    id: 'uslt',
    name: 'University of St. Louie Tuguegarao',
    logo: '/logos/uslt.png',
    color: '#8C1515'
  },
  {
    id: 'ucv',
    name: 'University of Cagayan Valley',
    logo: '/logos/ucv.png',
    color: '#A31F34'
  },
  {
    id: 'csu',
    name: 'Cagayan State University',
    logo: '/logos/csu.png',
    color: '#002147'
  },
  {
    id: 'mcnp',
    name: 'Medical Colleges of Northern Philippines',
    logo: '/logos/mcnp.png',
    color: '#4A90E2'
  },
]

export function getSchoolById(id: string): School | undefined {
  return SCHOOLS.find(school => school.id === id)
}

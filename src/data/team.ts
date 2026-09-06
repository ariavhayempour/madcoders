import type { ImageMetadata } from 'astro';

export interface Member {
  name: string;
  role: string;
  major: string;
  classOf: string;
  photo?: ImageMetadata; // imported asset; falls back to a placeholder when unset
  photoPosition?: string; // CSS object-position for the cropped circle; defaults to center
}

export interface TeamGroup {
  title: string;
  members: Member[];
}

export const team: TeamGroup[] = [
  {
    title: 'Executive Board',
    members: [
      { name: 'TBD', role: 'President & Founder', major: 'TBD', classOf: 'TBD' },
      { name: 'TBD', role: 'Vice President', major: 'TBD', classOf: 'TBD' },
      { name: 'TBD', role: 'Treasurer', major: 'TBD', classOf: 'TBD' },
      { name: 'TBD', role: 'Secretary', major: 'TBD', classOf: 'TBD' },
    ],
  },
  {
    title: 'Technical Leadership',
    members: [
      { name: 'TBD', role: 'Tech Lead', major: 'TBD', classOf: 'TBD' },
      { name: 'TBD', role: 'Project Lead', major: 'TBD', classOf: 'TBD' },
    ],
  },
  {
    title: 'Outreach & Operations',
    members: [
      { name: 'TBD', role: 'Outreach Chair', major: 'TBD', classOf: 'TBD' },
      { name: 'TBD', role: 'Media Chair', major: 'TBD', classOf: 'TBD' },
    ],
  },
];

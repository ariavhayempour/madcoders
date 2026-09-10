import type { ImageMetadata } from 'astro';

export interface Member {
  name: string;
  role: string;
  major: string;
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
      {
        name: 'Usman Mohammed',
        role: 'President',
        major: 'Computer Science & Political Science',
      },
      {
        name: 'Jeremy Moore',
        role: 'Vice President',
        major: 'Economics & Mathematics',
      },
      { name: 'TBD', role: 'Treasurer', major: 'TBD' },
      {
        name: 'Aditya Pall',
        role: 'Secretary',
        major: 'Computer Science & Data Science',
      },
      {
        name: 'Daniela Luseko',
        role: 'Social Chair',
        major: 'Political Science & History, Consulting Certificate',
      },
    ],
  },
  {
    title: 'Technical Leadership',
    members: [
      { name: 'TBD', role: 'Tech Lead', major: 'TBD' },
      {
        name: 'Ariav Hayempour',
        role: 'Project Management Chair',
        major: 'Computer & Data Science',
      },
      {
        name: 'Sabrin Ali',
        role: 'Project Management Chair',
        major: 'Computer Science & Economics',
      },
    ],
  },
  {
    title: 'Outreach & Operations',
    members: [
      {
        name: 'Bright Owusu-Ansah',
        role: 'Outreach Chair',
        major: 'Computer Science',
      },
      { name: 'TBD', role: 'Media Chair', major: 'TBD' },
    ],
  },
  {
    title: 'Advisors',
    members: [
      {
        name: 'Wilfred Shereni',
        role: 'Advisor',
        major: 'Computer, Data & Information Sciences',
      },
    ],
  },
];

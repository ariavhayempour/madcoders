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
      {
        name: 'Usman Mohammed',
        role: 'President',
        major: 'Computer Science & Political Science',
        classOf: 'Senior',
      },
      {
        name: 'Jeremy Moore',
        role: 'Vice President',
        major: 'Economics & Mathematics',
        classOf: 'Junior',
      },
      { name: 'TBD', role: 'Treasurer', major: 'TBD', classOf: 'TBD' },
      {
        name: 'Aditya Pall',
        role: 'Secretary',
        major: 'Computer Science & Data Science',
        classOf: 'Sophomore',
      },
      {
        name: 'Daniela Luseko',
        role: 'Social Chair',
        major: 'Political Science & History, Consulting Certificate',
        classOf: 'Senior',
      },
    ],
  },
  {
    title: 'Technical Leadership',
    members: [
      { name: 'TBD', role: 'Tech Lead', major: 'TBD', classOf: 'TBD' },
      {
        name: 'Sabrin Ali',
        role: 'Project Management Chair',
        major: 'Computer Science & Economics',
        classOf: 'Sophomore',
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
        classOf: 'Sophomore',
      },
      { name: 'TBD', role: 'Media Chair', major: 'TBD', classOf: 'TBD' },
    ],
  },
  {
    title: 'Advisors',
    members: [
      {
        name: 'Wilfred Shereni',
        role: 'Advisor',
        major: 'Computer, Data & Information Sciences',
        classOf: 'Senior',
      },
    ],
  },
];

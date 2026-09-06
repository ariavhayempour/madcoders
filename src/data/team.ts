import type { ImageMetadata } from 'astro';
import aditBhootra from '../assets/images/team/adit-bhootra.jpg';
import ariavHayempour from '../assets/images/team/ariav-hayempour.jpg';
import grantKastman from '../assets/images/team/grant-kastman.jpg';
import jeddJang from '../assets/images/team/jedd-jang.jpg';
import miaNgo from '../assets/images/team/mia-ngo.jpg';
import sunayPatel from '../assets/images/team/sunay-patel.jpg';
import tyWeaver from '../assets/images/team/ty-weaver.jpg';

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

// Roster migrated verbatim from the legacy Team page.
export const team: TeamGroup[] = [
  {
    title: 'Executive Board',
    members: [
      { name: 'Ty Weaver', role: 'President & Founder', major: 'Molecular Biology', classOf: 'Class of 2028', photo: tyWeaver, photoPosition: '80% 15%' },
      { name: 'Jedd Jang', role: 'Vice President & Co-Founder', major: 'Biochemistry', classOf: 'Class of 2028', photo: jeddJang },
      { name: 'Sunay Patel', role: 'Treasurer', major: 'Political & Data Science', classOf: 'Class of 2028', photo: sunayPatel },
      { name: 'Grant Kastman', role: 'Secretary', major: 'Biochemistry', classOf: 'Class of 2028', photo: grantKastman },
    ],
  },
  {
    title: 'Digest Leadership',
    members: [
      { name: 'Ty Weaver', role: 'Cardiovascular Digest', major: 'Molecular Biology', classOf: 'Class of 2028', photo: tyWeaver, photoPosition: '80% 15%' },
      { name: 'Jedd Jang', role: 'Cardiovascular Digest', major: 'Biochemistry', classOf: 'Class of 2028', photo: jeddJang },
      { name: 'Adit Bhootra', role: 'Cancer Digest', major: 'Biology', classOf: 'Class of 2028', photo: aditBhootra },
      { name: 'Mia Ngo', role: 'Neuroscience Digest', major: 'Neuroscience', classOf: 'Class of 2028', photo: miaNgo },
    ],
  },
  {
    title: 'Outreach & Media',
    members: [
      { name: 'Kevin Tran', role: 'Outreach Chair', major: 'Neuroscience', classOf: 'Class of 2028' },
      { name: 'TBD', role: 'Media Chair needed!', major: 'TBD', classOf: 'TBD' },
    ],
  },
  {
    title: 'Technology & Operations',
    members: [
      { name: 'Ariav Hayempour', role: 'TechOps Lead', major: 'Computer & Data Science', classOf: 'Class of 2028', photo: ariavHayempour },
    ],
  },
];

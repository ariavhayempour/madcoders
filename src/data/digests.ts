export interface Digest {
  icon: string;
  title: string;
  description: string;
}

// The digests currently in publication.
export const digests: Digest[] = [
  { icon: '❤️', title: 'Cardiovascular', description: 'Heart disease, vascular biology, cardiac imaging, and circulatory health research.' },
  { icon: '🎗️', title: 'Cancer', description: 'Oncology, tumor biology, immunotherapy, and precision cancer treatment.' },
  { icon: '🧠', title: 'Neuroscience', description: 'The brain and nervous system, neurodegeneration, cognition, and neural circuits.' },
];

/**
 * Content shown before an admin edits it. Matches the text the mobile app shipped with
 * (frontend/constants/defaultContent.ts keeps the same text as its offline fallback).
 */

export const DEFAULT_FAQS = [
  {
    question: 'How do I start designing?',
    answer: 'Tap the + tab and choose Design a room. Name your project, scan your room, then pick a style and budget to get AI layouts.',
  },
  {
    question: 'How do I measure a room?',
    answer: 'Scanning is the first step of Design a room. Follow the on-screen guides to mark the floor, wall height and corners, then confirm your room size.',
  },
  {
    question: 'Can I save my projects?',
    answer: 'Yes. Every Design a room project is listed under Profile → Projects. In the AR view, tap Export to save a 3D layout to that project.',
  },
  {
    question: 'How do I save an AR photo?',
    answer: 'In the AR view, tap the camera button on the bottom toolbar. The photo is saved to your gallery and to the project under Profile → Projects.',
  },
];

export const DEFAULT_LEGAL = {
  terms: [
    'By using the AR Interior Design App, you agree to these terms of service. The app provides tools for interior design planning and visualization.',
    '',
    '## User Responsibilities',
    '• You are responsible for the accuracy of measurements and project data',
    '• You must not use the app for illegal purposes',
    '• You must respect intellectual property rights',
    '',
    '## Service Availability',
    'We strive to maintain service availability but do not guarantee uninterrupted access. The service may be temporarily unavailable for maintenance or updates.',
  ].join('\n'),
  privacy: [
    '## Data Collection',
    'We collect information necessary to provide our services, including:',
    '• Account information (name, email)',
    '• Project data and designs',
    '• Usage analytics (anonymous)',
    '',
    '## Data Usage',
    'Your data is used to:',
    '• Provide and improve our services',
    '• Personalize your experience',
    '• Analyze app performance (anonymously)',
    '',
    '## Data Security',
    'We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.',
    '',
    '## Your Rights',
    'You have the right to:',
    '• Access your personal data',
    '• Request data deletion',
    '• Opt-out of analytics',
  ].join('\n'),
};

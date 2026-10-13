/**
 * Content shown before an admin edits it. Matches the text the mobile app shipped with
 * (frontend/constants/defaultContent.ts keeps the same text as its offline fallback).
 */

export const DEFAULT_FAQS = [
  {
    question: 'How do I start designing?',
    answer: 'Use the + tab — AR Furniture or AR Measurement — to begin.',
  },
  {
    question: 'How do I measure a room?',
    answer: 'Open AR Measurement from the + tab and follow the on-screen guides to scan and confirm your room size.',
  },
  {
    question: 'Can I save my projects?',
    answer: 'Yes. Export a layout from AR Furniture and it will appear under Profile → Projects. Photos you save also show up in the Wishlist tab.',
  },
  {
    question: 'How do I save an AR photo?',
    answer: 'After placing furniture, tap the camera button on the bottom toolbar. The photo is saved to your gallery and the Wishlist tab.',
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

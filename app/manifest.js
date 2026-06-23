export default function manifest() {
  return {
    name: 'عيادة د. محمد تيسير ذبالح',
    short_name: 'عيادة الأسنان',
    description: 'نظام إدارة عيادة الدكتور محمد تيسير ذبالح لطب الأسنان',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#1B4965',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  };
}

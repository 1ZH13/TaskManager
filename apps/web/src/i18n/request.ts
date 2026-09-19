import { getRequestConfig } from 'next-intl/server';
export default getRequestConfig(async () => ({ locale: 'es-PA', messages: (await import('../messages/es-PA.json')).default }));

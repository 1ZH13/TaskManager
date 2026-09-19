import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = { transpilePackages: ['@task-manager/ui', '@task-manager/shared'] };
export default createNextIntlPlugin('./src/i18n/request.ts')(config);

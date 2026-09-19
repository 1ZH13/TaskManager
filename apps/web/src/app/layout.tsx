import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import './globals.css';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
export const metadata: Metadata = { title: 'TaskManager', description: 'Gestión de trabajo para propiedades horizontales' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es-PA"><body className={inter.variable}><NextIntlClientProvider locale="es-PA">{children}</NextIntlClientProvider></body></html>; }

import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DocuMind AI - Document Intelligence Platform',
  description: 'Upload PDF documents and interact with them using page-aware semantic search and RAG powered by Google Gemini.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

import matter from 'gray-matter';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface NowEntry {
	title: string;
	date: string;
	location?: string;
	images?: string[];
	slug: string;
	content: string;
}

export function parseNowEntry(fileContent: string, slug: string): NowEntry {
	const { data, content } = matter(fileContent);

	return {
		title: data.title || '',
		date: data.date || '',
		location: data.location,
		images: [], // Images are now loaded automatically from images/now/{slug}/ directory
		slug: data.slug || slug,
		content: content.trim(),
	};
}

export function loadNowEntries(): NowEntry[] {
	const contentDir = join(process.cwd(), 'src/assets/content/now');
	const files = readdirSync(contentDir).filter((file) => file.endsWith('.md'));

	const entries: NowEntry[] = files.map((file) => {
		const filePath = join(contentDir, file);
		const fileContent = readFileSync(filePath, 'utf-8');
		const filename = file.replace('.md', '');
		const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
		return parseNowEntry(fileContent, slug);
	});

	return sortEntriesByDate(entries);
}

export function sortEntriesByDate(entries: NowEntry[]): NowEntry[] {
	return [...entries].sort((a, b) => {
		const dateA = new Date(a.date).getTime();
		const dateB = new Date(b.date).getTime();
		return dateB - dateA;
	});
}

export function getNowEntryBySlug(slug: string): NowEntry | null {
	const entries = loadNowEntries();
	return entries.find((entry) => entry.slug === slug) || null;
}


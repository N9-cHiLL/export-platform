"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabase";

type TabId = "requirements" | "schemes" | "trade-data";

type MerchantRequirementRow = {
	id: string;
	user_id: string;
	title: string;
	description: string;
	product_category: string | null;
	region_or_country: string | null;
	quantity_notes: string | null;
	created_at: string | null;
};

const TABS: { id: TabId; label: string; description: string }[] = [
	{ id: "requirements", label: "Merchant requirements", description: "Post and browse sourcing & export needs worldwide." },
	{ id: "schemes", label: "Government schemes", description: "India & Rajasthan programmes to support exporters." },
	{ id: "trade-data", label: "Global trade data", description: "Official sources for trade statistics and market insight." },
];

const CENTRAL_SCHEMES = [
	{
		name: "DGFT — Directorate General of Foreign Trade",
		href: "https://www.dgft.gov.in/",
		note: "India’s export–import policy, licences, and trade notices.",
	},
	{
		name: "MSME — Schemes & portals",
		href: "https://msme.gov.in/",
		note: "Central schemes for micro, small, and medium enterprises including export-oriented support.",
	},
	{
		name: "RoDTEP (Remission of Duties and Taxes on Exported Products)",
		href: "https://www.dgft.gov.in/",
		note: "Refund of embedded taxes on exported products — check current rates and notifications on DGFT.",
	},
	{
		name: "FIEO — Federation of Indian Export Organisations",
		href: "https://www.fieo.org/",
		note: "Trade leads, events, and exporter resources.",
	},
];

const RAJASTHAN_SCHEMES = [
	{
		name: "Industries & investment — Government of Rajasthan",
		href: "https://invest.rajasthan.gov.in/",
		note: "State industrial policy, incentives, and sector information relevant to exporters.",
	},
	{
		name: "RIICO — Rajasthan State Industrial Development & Investment Corporation",
		href: "https://www.riico.co.in/",
		note: "Industrial areas, plots, and infrastructure for manufacturing and export units.",
	},
	{
		name: "Rajasthan MSME",
		href: "https://msme.rajasthan.gov.in/",
		note: "State MSME support, registrations, and schemes.",
	},
];

const TRADE_DATA_SOURCES = [
	{
		name: "UN Comtrade",
		href: "https://comtradeplus.un.org/",
		note: "United Nations international trade statistics — detailed commodity and partner country data.",
	},
	{
		name: "WTO — Trade statistics",
		href: "https://www.wto.org/english/res_e/statis_e/statis_e.htm",
		note: "World Trade Organization official trade and tariff statistics.",
	},
	{
		name: "ITC Trade Map",
		href: "https://www.trademap.org/",
		note: "Interactive maps and tables for exports, imports, and market diversification.",
	},
	{
		name: "World Bank — WITS (Trade & tariffs)",
		href: "https://wits.worldbank.org/",
		note: "Applied tariffs, trade flows, and development indicators.",
	},
	{
		name: "OECD — Trade in goods and services",
		href: "https://www.oecd.org/trade/",
		note: "Cross-country trade policy and statistics (useful for comparing markets).",
	},
];

function formatDate(iso: string | null) {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
	} catch {
		return iso;
	}
}

export default function OpportunitiesPage() {
	const [tab, setTab] = useState<TabId>("requirements");
	const [userId, setUserId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [rows, setRows] = useState<MerchantRequirementRow[]>([]);
	const [listError, setListError] = useState<string | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [productCategory, setProductCategory] = useState("");
	const [regionOrCountry, setRegionOrCountry] = useState("");
	const [quantityNotes, setQuantityNotes] = useState("");

	const loadRequirements = useCallback(async () => {
		setListError(null);
		const { data, error } = await supabase
			.from("merchant_requirements")
			.select("id,user_id,title,description,product_category,region_or_country,quantity_notes,created_at")
			.order("created_at", { ascending: false })
			.limit(100);

		if (error) {
			setListError(
				`Could not load requirements. If this is new, run the SQL in app/-- Create merchant_requirements.sql in Supabase. (${error.message})`
			);
			setRows([]);
			return;
		}
		setRows((data ?? []) as MerchantRequirementRow[]);
	}, []);

	useEffect(() => {
		let mounted = true;

		async function init() {
			setLoading(true);
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (mounted) setUserId(user?.id ?? null);
			await loadRequirements();
			if (mounted) setLoading(false);
		}

		init();

		const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
			setUserId(session?.user?.id ?? null);
		});

		return () => {
			mounted = false;
			sub.subscription.unsubscribe();
		};
	}, [loadRequirements]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormError(null);
		setFormSuccess(null);

		if (!userId) {
			setFormError("Please sign in from the home page to post a requirement.");
			return;
		}

		const t = title.trim();
		const d = description.trim();
		if (t.length < 3) {
			setFormError("Title must be at least 3 characters.");
			return;
		}
		if (d.length < 10) {
			setFormError("Description must be at least 10 characters.");
			return;
		}

		setSubmitting(true);
		try {
			const { error } = await supabase.from("merchant_requirements").insert({
				user_id: userId,
				title: t,
				description: d,
				product_category: productCategory.trim() || null,
				region_or_country: regionOrCountry.trim() || null,
				quantity_notes: quantityNotes.trim() || null,
			});

			if (error) throw error;

			setFormSuccess("Your requirement is live.");
			setTitle("");
			setDescription("");
			setProductCategory("");
			setRegionOrCountry("");
			setQuantityNotes("");
			await loadRequirements();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setFormError(msg);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
				<header className="mb-8">
					<Link href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
						← Back to home
					</Link>
					<h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
						Exploring opportunities
					</h1>
					<p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
						Discover buyers and sellers, government support, and global trade intelligence — in one place.
					</p>
				</header>

				{/* Tab bar */}
				<div
					role="tablist"
					aria-label="Opportunity sections"
					className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:border-b sm:border-zinc-200 dark:sm:border-zinc-800 mb-8"
				>
					{TABS.map((item) => {
						const selected = tab === item.id;
						return (
							<button
								key={item.id}
								type="button"
								role="tab"
								aria-selected={selected}
								id={`tab-${item.id}`}
								aria-controls={`panel-${item.id}`}
								onClick={() => setTab(item.id)}
								className={`text-left px-4 py-3 rounded-lg sm:rounded-none sm:rounded-t-lg text-sm font-medium transition-colors border sm:border-b-0 ${
									selected
										? "bg-blue-600 text-white border-blue-600 sm:bg-zinc-100 sm:text-blue-800 dark:sm:bg-zinc-800 dark:sm:text-blue-200 sm:border-zinc-300 dark:sm:border-zinc-600"
										: "bg-zinc-100/80 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-800"
								}`}
							>
								{item.label}
							</button>
						);
					})}
				</div>

				{tab === "requirements" && (
					<section id="panel-requirements" role="tabpanel" aria-labelledby="tab-requirements" className="space-y-10">
						<div>
							<h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Global merchant requirements</h2>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								Post what you need (sourcing, partnerships, export volumes) or browse posts from merchants worldwide.
							</p>
						</div>

						<div className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur rounded-2xl p-6 shadow border border-zinc-200/80 dark:border-zinc-800">
							<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">Post a requirement</h3>
							{!userId && (
								<p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">
									Sign in on the home page to publish. Everyone can browse listings below.
								</p>
							)}
							<form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
									<input
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
										placeholder="e.g. Seeking organic textiles for EU retail"
										required
										minLength={3}
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
									<textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										rows={4}
										className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
										placeholder="Product specs, timelines, certifications, how you prefer to be contacted (via platform follow-up)."
										required
										minLength={10}
									/>
								</div>
								<div className="grid sm:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Product / category</label>
										<input
											value={productCategory}
											onChange={(e) => setProductCategory(e.target.value)}
											className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
											placeholder="e.g. Home textiles"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Your region / country</label>
										<input
											value={regionOrCountry}
											onChange={(e) => setRegionOrCountry(e.target.value)}
											className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
											placeholder="e.g. Rajasthan, India"
										/>
									</div>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Volume or timing (optional)</label>
									<input
										value={quantityNotes}
										onChange={(e) => setQuantityNotes(e.target.value)}
										className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
										placeholder="e.g. First order 500 units, quarterly"
									/>
								</div>
								{formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
								{formSuccess && <p className="text-sm text-green-700 dark:text-green-400">{formSuccess}</p>}
								<button
									type="submit"
									disabled={!userId || submitting}
									className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg"
								>
									{submitting ? "Publishing…" : "Publish requirement"}
								</button>
							</form>
						</div>

						<div>
							<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">Recent listings</h3>
							{loading && <p className="text-sm text-zinc-500">Loading…</p>}
							{listError && <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>}
							{!loading && !listError && rows.length === 0 && (
								<p className="text-sm text-zinc-600 dark:text-zinc-400">No requirements yet. Be the first to post.</p>
							)}
							<ul className="space-y-4">
								{rows.map((row) => (
									<li
										key={row.id}
										className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm"
									>
										<div className="flex flex-wrap items-start justify-between gap-2">
											<h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{row.title}</h4>
											<span className="text-xs text-zinc-500 whitespace-nowrap">{formatDate(row.created_at)}</span>
										</div>
										<p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{row.description}</p>
										<dl className="mt-3 grid sm:grid-cols-3 gap-2 text-sm">
											{row.product_category && (
												<div>
													<dt className="text-zinc-500">Category</dt>
													<dd className="text-zinc-800 dark:text-zinc-200">{row.product_category}</dd>
												</div>
											)}
											{row.region_or_country && (
												<div>
													<dt className="text-zinc-500">Region</dt>
													<dd className="text-zinc-800 dark:text-zinc-200">{row.region_or_country}</dd>
												</div>
											)}
											{row.quantity_notes && (
												<div>
													<dt className="text-zinc-500">Volume / timing</dt>
													<dd className="text-zinc-800 dark:text-zinc-200">{row.quantity_notes}</dd>
												</div>
											)}
										</dl>
									</li>
								))}
							</ul>
						</div>
					</section>
				)}

				{tab === "schemes" && (
					<section id="panel-schemes" role="tabpanel" aria-labelledby="tab-schemes" className="space-y-10">
						<p className="text-zinc-600 dark:text-zinc-400">
							Use these entry points to explore current schemes, notifications, and state-level support. Always verify eligibility on the official portal before applying.
						</p>

						<div>
							<h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Government of India</h2>
							<ul className="space-y-3">
								{CENTRAL_SCHEMES.map((item) => (
									<li key={item.href} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-white/80 dark:bg-zinc-900/40">
										<a href={item.href} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
											{item.name}
										</a>
										<p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{item.note}</p>
									</li>
								))}
							</ul>
						</div>

						<div>
							<h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Government of Rajasthan</h2>
							<ul className="space-y-3">
								{RAJASTHAN_SCHEMES.map((item) => (
									<li key={item.href} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-white/80 dark:bg-zinc-900/40">
										<a href={item.href} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
											{item.name}
										</a>
										<p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{item.note}</p>
									</li>
								))}
							</ul>
						</div>
					</section>
				)}

				{tab === "trade-data" && (
					<section id="panel-trade-data" role="tabpanel" aria-labelledby="tab-trade-data" className="space-y-6">
						<p className="text-zinc-600 dark:text-zinc-400">
							These are authoritative third-party databases for global trade flows, tariffs, and markets. Open a source in a new tab to query HS codes, partners, and trends.
						</p>
						<ul className="space-y-3">
							{TRADE_DATA_SOURCES.map((item) => (
								<li key={item.href} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-white/80 dark:bg-zinc-900/40">
									<a href={item.href} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
										{item.name}
									</a>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{item.note}</p>
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</main>
	);
}

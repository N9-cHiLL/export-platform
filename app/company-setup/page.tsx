"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabase";

type CompanyDetailsRow = {
	user_id: string;
	company_name: string | null;
	industry: string | null;
	country: string | null;
	address: string | null;
	website: string | null;
	tax_id: string | null;
	incorporation_date: string | null;
	created_at: string | null;
	updated_at: string | null;
};

type Mode = "documents" | "scratch";

function safeTrim(s: string) {
	return s.trim();
}

function extractField(patterns: RegExp[], input: string) {
	for (const p of patterns) {
		const m = input.match(p);
		if (m?.[1]) return m[1].trim();
	}
	return null;
}

export default function CompanySetupPage() {
	const [loading, setLoading] = useState(true);
	const [userId, setUserId] = useState<string | null>(null);
	const [currentStep, setCurrentStep] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [companyDetails, setCompanyDetails] = useState<CompanyDetailsRow | null>(null);
	const [mode, setMode] = useState<Mode>("documents");

	// Documents (MVP: user pastes extracted text)
	const [docsText, setDocsText] = useState("");

	// Scratch / confirmation form (used for both modes)
	const [companyName, setCompanyName] = useState("");
	const [industry, setIndustry] = useState("");
	const [country, setCountry] = useState("");
	const [address, setAddress] = useState("");
	const [website, setWebsite] = useState("");
	const [taxId, setTaxId] = useState("");
	const [incorporationDate, setIncorporationDate] = useState("");

	const [submitLoading, setSubmitLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const docParsingHelp = useMemo(() => {
		return {
			companyName: extractField(
				[/company\s*name\s*[:\-]\s*([^\n\r]+)/i, /name\s*of\s*company\s*[:\-]\s*([^\n\r]+)/i],
				docsText
			),
			industry: extractField([/industry\s*[:\-]\s*([^\n\r]+)/i], docsText),
			country: extractField(
				[/country\s*[:\-]\s*([^\n\r]+)/i, /incorporated\s*in\s*([^\n\r]+)/i],
				docsText
			),
			website: extractField([/website\s*[:\-]\s*(https?:\/\/\S+|\S+)/i, /(www\.\S+)/i], docsText),
		};
	}, [docsText]);

	useEffect(() => {
		let mounted = true;

		async function init() {
			setLoading(true);
			setError(null);
			setSuccessMessage(null);

			try {
				const {
					data: { user },
					error: userErr,
				} = await supabase.auth.getUser();
				if (userErr) throw userErr;

				if (!user) {
					setError("Please sign in to set up your company.");
					setCompanyDetails(null);
					return;
				}

				if (!mounted) return;
				setUserId(user.id);

				// Ensure journey row exists and move user to step 2.
				const { data: journeyRows, error: journeyErr } = await supabase
					.from("user_journey")
					.select("current_step")
					.eq("user_id", user.id)
					.limit(1);

				if (journeyErr) throw journeyErr;

				const existingJourney = journeyRows?.[0] ?? null;
				const stepFromDb = existingJourney?.current_step != null ? Number(existingJourney.current_step) : null;

				if (stepFromDb == null) {
					await supabase.from("user_journey").upsert({ user_id: user.id, current_step: 2 });
					setCurrentStep(2);
				} else {
					setCurrentStep(stepFromDb);
					if (stepFromDb < 2) {
						await supabase.from("user_journey").upsert({ user_id: user.id, current_step: 2 });
						setCurrentStep(2);
					}
				}

				// Fetch company details (if already created).
				const { data: companyRows, error: companyErr } = await supabase
					.from("company_details")
					.select("*")
					.eq("user_id", user.id)
					.limit(1);

				if (companyErr) {
					// Most likely cause: schema tables not created yet in Supabase.
					throw new Error(
						`Failed to load company details. Ensure you ran the SQL in app/-- Create company setup tables.sql. (${companyErr.message})`
					);
				}

				const company = (companyRows?.[0] ?? null) as CompanyDetailsRow | null;
				setCompanyDetails(company);

				if (company) {
					setCompanyName(company.company_name ?? "");
					setIndustry(company.industry ?? "");
					setCountry(company.country ?? "");
					setAddress(company.address ?? "");
					setWebsite(company.website ?? "");
					setTaxId(company.tax_id ?? "");
					setIncorporationDate(company.incorporation_date ?? "");
				}
			} catch (e: any) {
				if (!mounted) return;
				setError(String(e?.message || e));
			} finally {
				if (mounted) setLoading(false);
			}
		}

		init();

		return () => {
			mounted = false;
		};
	}, []);

	function fillFromParsedDocs() {
		setCompanyName(docParsingHelp.companyName ?? companyName);
		setIndustry(docParsingHelp.industry ?? industry);
		setCountry(docParsingHelp.country ?? country);
		setWebsite(docParsingHelp.website ?? website);
	}

	async function submitCreateOrUpdate() {
		if (!userId) return;

		setSubmitLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			const nameTrimmed = safeTrim(companyName);
			if (!nameTrimmed) {
				throw new Error("Company name is required.");
			}

			if (mode === "documents" && safeTrim(docsText).length < 20) {
				throw new Error("Please paste company documents text (at least a few lines), or switch to 'Set up from scratch'.");
			}

			// Upsert company details.
			const { error: detailsErr } = await supabase.from("company_details").upsert(
				{
					user_id: userId,
					company_name: safeTrim(companyName) || null,
					industry: safeTrim(industry) || null,
					country: safeTrim(country) || null,
					address: safeTrim(address) || null,
					website: safeTrim(website) || null,
					tax_id: safeTrim(taxId) || null,
					incorporation_date: safeTrim(incorporationDate) || null,
				},
				{ onConflict: "user_id" }
			);

			if (detailsErr) throw detailsErr;

			// Store pasted documents for audit/training (MVP).
			if (mode === "documents" && safeTrim(docsText).length > 0) {
				const docContent = docsText.trim();
				const { error: docErr } = await supabase.from("company_documents").insert({
					id: crypto.randomUUID(),
					user_id: userId,
					document_type: "company_documents",
					content: docContent,
				});
				if (docErr) throw docErr;
			}

			// Mark step 2 complete (journey step 3 is the next logical step).
			await supabase.from("user_journey").upsert({ user_id: userId, current_step: 3 });
			setCurrentStep(3);

			setSuccessMessage("Company setup saved successfully.");
			setCompanyDetails({
				user_id: userId,
				company_name: safeTrim(companyName) || null,
				industry: safeTrim(industry) || null,
				country: safeTrim(country) || null,
				address: safeTrim(address) || null,
				website: safeTrim(website) || null,
				tax_id: safeTrim(taxId) || null,
				incorporation_date: safeTrim(incorporationDate) || null,
				created_at: null,
				updated_at: null,
			});
		} catch (e: any) {
			setError(String(e?.message || e));
		} finally {
			setSubmitLoading(false);
		}
	}

	return (
		<main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-8">
			<div className="max-w-4xl mx-auto">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Company Setup</h1>
						<p className="mt-2 text-zinc-600 dark:text-zinc-400">
							{currentStep != null ? `Journey step: ${currentStep}` : "Complete your company details to continue."}
						</p>
					</div>
					<Link href="/" className="text-sm text-blue-700 hover:underline dark:text-blue-400">
						Back to homepage
					</Link>
				</div>

				{loading && <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading your company setup...</div>}
				{error && <div className="text-sm text-red-600 dark:text-red-400 mb-4">Error: {error}</div>}
				{successMessage && <div className="text-sm text-green-700 dark:text-green-300 mb-4">{successMessage}</div>}

				{!loading && !error && (
					<>
						{companyDetails ? (
							<div className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow">
								<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">We found your company details</h2>
								<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
									<div className="rounded-lg border p-3">
										<div className="text-zinc-500">Company name</div>
										<div className="font-medium">{companyDetails.company_name ?? "-"}</div>
									</div>
									<div className="rounded-lg border p-3">
										<div className="text-zinc-500">Industry</div>
										<div className="font-medium">{companyDetails.industry ?? "-"}</div>
									</div>
									<div className="rounded-lg border p-3">
										<div className="text-zinc-500">Country</div>
										<div className="font-medium">{companyDetails.country ?? "-"}</div>
									</div>
									<div className="rounded-lg border p-3">
										<div className="text-zinc-500">Website</div>
										<div className="font-medium break-all">{companyDetails.website ?? "-"}</div>
									</div>
								</div>

								<div className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">
									You can update your details below if anything changed.
								</div>
							</div>
						) : (
							<div className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow mb-5">
								<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No company details found</h2>
								<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
									Choose one: provide your company documents (paste text for MVP) or set up from scratch.
								</p>
							</div>
						)}

						<div className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Create / update details</h2>

							<div className="mt-4 flex flex-col sm:flex-row gap-3">
								<button
									type="button"
									onClick={() => setMode("documents")}
									className={`px-4 py-2 rounded-lg border text-sm ${
										mode === "documents"
											? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
											: "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
									}`}
								>
									Use documents
								</button>
								<button
									type="button"
									onClick={() => setMode("scratch")}
									className={`px-4 py-2 rounded-lg border text-sm ${
										mode === "scratch"
											? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
											: "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
									}`}
								>
									Set up from scratch
								</button>
							</div>

							{mode === "documents" && (
								<div className="mt-4">
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">
										Paste your company documents (text)
									</label>
									<textarea
										value={docsText}
										onChange={(e) => setDocsText(e.target.value)}
										rows={6}
										className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
										placeholder="Paste text from your documents here. Example fields: Company Name, Address, Country, Website, etc."
									/>

									<div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
										<div className="text-xs text-zinc-600 dark:text-zinc-400">
											Optional: we’ll try to auto-fill a few fields from the pasted text.
										</div>
										<button type="button" onClick={fillFromParsedDocs} className="text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
											Auto-fill from documents
										</button>
									</div>

									{safeTrim(docsText).length > 0 && (
										<div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
											Detected: {docParsingHelp.companyName ? `Company name: "${docParsingHelp.companyName}"` : "Company name not found"}
											{docParsingHelp.country ? `, Country: "${docParsingHelp.country}"` : ""}
										</div>
									)}
								</div>
							)}

							<div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Company name *</label>
									<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" placeholder="Your company legal name" />
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Industry</label>
									<input value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" placeholder="e.g., Textiles" />
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Country</label>
									<input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" placeholder="e.g., India" />
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Website</label>
									<input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" placeholder="e.g., https://example.com" />
								</div>
								<div className="sm:col-span-2">
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Address</label>
									<textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" placeholder="Street, city, state" />
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Tax ID</label>
									<input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" placeholder="GST / VAT / tax number" />
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Incorporation date</label>
									<input type="date" value={incorporationDate} onChange={(e) => setIncorporationDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
								</div>
							</div>

							<div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
								<div className="text-xs text-zinc-600 dark:text-zinc-400">
									When you submit, we’ll save your company details in the database.
								</div>
								<button
									type="button"
									onClick={submitCreateOrUpdate}
									disabled={submitLoading}
									className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white px-5 py-2 rounded-lg text-sm font-medium"
								>
									{submitLoading ? "Saving..." : companyDetails ? "Save updates" : "Create company details"}
								</button>
							</div>

							{currentStep != null && currentStep >= 3 && (
								<div className="mt-4 text-sm text-green-700 dark:text-green-300">
									Company setup is marked complete on your journey.
								</div>
							)}
						</div>
					</>
				)}
			</div>
		</main>
	);
}


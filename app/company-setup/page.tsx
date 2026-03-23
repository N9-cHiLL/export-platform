"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabase";
import {
	COMPANY_DOCUMENT_REQUIREMENTS,
	type CompanyDocumentTypeKey,
	SUBMISSION_KIND,
} from "../../src/lib/companyDocumentRequirements";

const STORAGE_BUCKET = "company-documents";
/** Max 200 KB per document (JPEG or PDF) */
const MAX_COMPANY_DOC_BYTES = 200 * 1024;

const REQUIREMENT_KEYS = COMPANY_DOCUMENT_REQUIREMENTS.map((r) => r.key);

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

type ReqChoice = "upload" | "apply" | null;

type ReqSlotState = {
	choice: ReqChoice;
	file: File | null;
	applyNotes: string;
	existingStoragePath: string | null;
	existingFileName: string | null;
	existingSubmissionKind: string | null;
};

function emptySlot(): ReqSlotState {
	return {
		choice: null,
		file: null,
		applyNotes: "",
		existingStoragePath: null,
		existingFileName: null,
		existingSubmissionKind: null,
	};
}

function initialReqSlots(): Record<CompanyDocumentTypeKey, ReqSlotState> {
	return {
		gst_certificate: emptySlot(),
		company_registration_certificate: emptySlot(),
		company_pan: emptySlot(),
		authorized_person_aadhaar: emptySlot(),
	};
}

function safeTrim(s: string) {
	return s.trim();
}

function sanitizeFileName(name: string) {
	return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document";
}

function validateCompanyDocFile(f: File): string | null {
	if (f.size > MAX_COMPANY_DOC_BYTES) {
		return `${f.name}: max 200 KB per file (this file is ${Math.ceil(f.size / 1024)} KB)`;
	}
	const lower = f.name.toLowerCase();
	const mime = (f.type || "").toLowerCase();
	const isPdf = lower.endsWith(".pdf") || mime === "application/pdf";
	const isJpeg = /\.(jpe?g)$/.test(lower) || mime === "image/jpeg";
	if (!isPdf && !isJpeg) {
		return `${f.name}: only JPEG or PDF allowed`;
	}
	return null;
}

function resolveUploadContentType(file: File): string {
	const lower = file.name.toLowerCase();
	if (lower.endsWith(".pdf") || file.type === "application/pdf") return "application/pdf";
	return "image/jpeg";
}

function isRequirementSatisfied(slot: ReqSlotState): boolean {
	if (slot.choice === "apply") return true;
	if (slot.choice === "upload" && (slot.file !== null || !!slot.existingStoragePath)) return true;
	return false;
}

function allRequirementsSatisfied(slots: Record<CompanyDocumentTypeKey, ReqSlotState>): boolean {
	return REQUIREMENT_KEYS.every((k) => isRequirementSatisfied(slots[k]));
}

export default function CompanySetupPage() {
	const [loading, setLoading] = useState(true);
	const [userId, setUserId] = useState<string | null>(null);
	const [currentStep, setCurrentStep] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [companyDetails, setCompanyDetails] = useState<CompanyDetailsRow | null>(null);
	const [mode, setMode] = useState<Mode>("documents");

	const [reqSlots, setReqSlots] = useState<Record<CompanyDocumentTypeKey, ReqSlotState>>(initialReqSlots);
	const [reqFileErrors, setReqFileErrors] = useState<Record<CompanyDocumentTypeKey, string | null>>({});

	const [companyName, setCompanyName] = useState("");
	const [industry, setIndustry] = useState("");
	const [country, setCountry] = useState("");
	const [address, setAddress] = useState("");
	const [website, setWebsite] = useState("");
	const [taxId, setTaxId] = useState("");
	const [incorporationDate, setIncorporationDate] = useState("");

	const [submitLoading, setSubmitLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

				const { data: companyRows, error: companyErr } = await supabase
					.from("company_details")
					.select("*")
					.eq("user_id", user.id)
					.limit(1);

				if (companyErr) {
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

				const { data: docRows, error: docErr } = await supabase
					.from("company_documents")
					.select("*")
					.eq("user_id", user.id)
					.in("document_type", REQUIREMENT_KEYS);

				if (docErr) {
					throw new Error(
						`Failed to load company documents. Run app/-- Alter company_documents submission.sql if columns are missing. (${docErr.message})`
					);
				}

				const next = initialReqSlots();
				for (const row of docRows ?? []) {
					const key = row.document_type as CompanyDocumentTypeKey;
					if (!REQUIREMENT_KEYS.includes(key)) continue;
					const sk = row.submission_kind as string | null;
					const isApply = sk === SUBMISSION_KIND.APPLY_FOR_DOCUMENT;
					next[key] = {
						choice: isApply ? "apply" : "upload",
						file: null,
						applyNotes: (row.application_notes as string) ?? "",
						existingStoragePath: (row.storage_path as string) ?? null,
						existingFileName: (row.original_file_name as string) ?? null,
						existingSubmissionKind: sk,
					};
				}
				setReqSlots(next);
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

	function setChoice(key: CompanyDocumentTypeKey, choice: "upload" | "apply") {
		setReqSlots((prev) => ({
			...prev,
			[key]: {
				...prev[key],
				choice,
				file: choice === "apply" ? null : prev[key].file,
				applyNotes: choice === "upload" ? "" : prev[key].applyNotes,
			},
		}));
		if (choice === "upload") {
			setReqFileErrors((e) => ({ ...e, [key]: null }));
		}
	}

	function onReqFile(key: CompanyDocumentTypeKey, e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0] ?? null;
		setReqFileErrors((prev) => ({ ...prev, [key]: null }));
		if (!f) return;
		const err = validateCompanyDocFile(f);
		if (err) {
			setReqFileErrors((prev) => ({ ...prev, [key]: err }));
			return;
		}
		setReqSlots((prev) => ({
			...prev,
			[key]: {
				...prev[key],
				choice: "upload",
				file: f,
			},
		}));
		e.target.value = "";
	}

	function clearReqFile(key: CompanyDocumentTypeKey) {
		setReqSlots((prev) => ({
			...prev,
			[key]: { ...prev[key], file: null },
		}));
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

			if (!allRequirementsSatisfied(reqSlots)) {
				throw new Error(
					"For each required document, either upload a file (JPEG or PDF, max 200 KB) or choose “Apply for this document” if you don’t have it yet."
				);
			}

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

			const { data: prevRows, error: prevErr } = await supabase
				.from("company_documents")
				.select("*")
				.eq("user_id", userId)
				.in("document_type", REQUIREMENT_KEYS);

			if (prevErr) throw prevErr;

			const prevByKey = new Map((prevRows ?? []).map((r) => [r.document_type as string, r]));

			for (const { key } of COMPANY_DOCUMENT_REQUIREMENTS) {
				const slot = reqSlots[key];
				const prev = prevByKey.get(key) as
					| { storage_path?: string | null; document_type?: string }
					| undefined;

				if (slot.choice === "apply") {
					if (prev?.storage_path) {
						const { error: rmErr } = await supabase.storage.from(STORAGE_BUCKET).remove([prev.storage_path as string]);
						if (rmErr) console.warn("storage remove", rmErr);
					}
					await supabase.from("company_documents").delete().eq("user_id", userId).eq("document_type", key);
					const { error: insErr } = await supabase.from("company_documents").insert({
						id: crypto.randomUUID(),
						user_id: userId,
						document_type: key,
						submission_kind: SUBMISSION_KIND.APPLY_FOR_DOCUMENT,
						application_notes: safeTrim(slot.applyNotes) || null,
						content: null,
						storage_path: null,
						original_file_name: null,
						mime_type: null,
						size_bytes: null,
					});
					if (insErr) throw insErr;
					continue;
				}

				if (slot.choice === "upload") {
					if (slot.file) {
						if (prev?.storage_path) {
							const { error: rmErr } = await supabase.storage.from(STORAGE_BUCKET).remove([prev.storage_path as string]);
							if (rmErr) console.warn("storage remove", rmErr);
						}
						await supabase.from("company_documents").delete().eq("user_id", userId).eq("document_type", key);

						const v = validateCompanyDocFile(slot.file);
						if (v) throw new Error(v);

						const objectPath = `${userId}/${crypto.randomUUID()}_${sanitizeFileName(slot.file.name)}`;
						const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, slot.file, {
							cacheControl: "3600",
							contentType: resolveUploadContentType(slot.file),
							upsert: false,
						});

						if (upErr) {
							throw new Error(
								`Upload failed for ${key}: ${upErr.message}. Ensure bucket "${STORAGE_BUCKET}" exists and app/-- Create company documents storage.sql was run.`
							);
						}

						const { error: docErr } = await supabase.from("company_documents").insert({
							id: crypto.randomUUID(),
							user_id: userId,
							document_type: key,
							submission_kind: SUBMISSION_KIND.UPLOAD,
							application_notes: null,
							content: null,
							storage_path: objectPath,
							original_file_name: slot.file.name,
							mime_type: resolveUploadContentType(slot.file),
							size_bytes: slot.file.size,
						});
						if (docErr) throw docErr;
					}
					// unchanged existing upload: no DB change
				}
			}

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

			const { data: refreshed } = await supabase
				.from("company_documents")
				.select("*")
				.eq("user_id", userId)
				.in("document_type", REQUIREMENT_KEYS);
			const nextSlots = initialReqSlots();
			for (const row of refreshed ?? []) {
				const rk = row.document_type as CompanyDocumentTypeKey;
				if (!REQUIREMENT_KEYS.includes(rk)) continue;
				const isApply = row.submission_kind === SUBMISSION_KIND.APPLY_FOR_DOCUMENT;
				nextSlots[rk] = {
					choice: isApply ? "apply" : "upload",
					file: null,
					applyNotes: (row.application_notes as string) ?? "",
					existingStoragePath: (row.storage_path as string) ?? null,
					existingFileName: (row.original_file_name as string) ?? null,
					existingSubmissionKind: row.submission_kind as string | null,
				};
			}
			setReqSlots(nextSlots);
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
									You can update your details and documents below if anything changed.
								</div>
							</div>
						) : (
							<div className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow mb-5">
								<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No company details found</h2>
								<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
									Complete the required business documents (upload or apply), then fill in your company profile.
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
							<p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
								{mode === "documents"
									? "You’ll attach the standard business documents below (or request help for any you don’t have yet)."
									: "Enter company details manually. You must still complete each required document below—upload a file or apply if you don’t have it."}
							</p>

							<div className="mt-6 space-y-4">
								<h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Required business documents</h3>
								<p className="text-xs text-zinc-600 dark:text-zinc-400">
									JPEG or PDF, max <strong>200 KB</strong> per file. For each item, upload your file or choose{" "}
									<strong>Apply for this document</strong> if you need assistance obtaining it.
								</p>
								{COMPANY_DOCUMENT_REQUIREMENTS.map(({ key, label, description }) => {
									const slot = reqSlots[key];
									const satisfied = isRequirementSatisfied(slot);
									return (
										<div
											key={key}
											className={`rounded-xl border p-4 ${
												satisfied ? "border-green-200 bg-green-50/30 dark:border-green-900/50 dark:bg-green-950/10" : "border-zinc-200 dark:border-zinc-800"
											}`}
										>
											<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
												<div>
													<div className="font-medium text-zinc-900 dark:text-zinc-50">{label}</div>
													<div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{description}</div>
												</div>
												{satisfied ? (
													<span className="text-xs text-green-700 dark:text-green-400 shrink-0">Ready</span>
												) : (
													<span className="text-xs text-amber-700 dark:text-amber-300 shrink-0">Action needed</span>
												)}
											</div>

											<div className="mt-3 flex flex-wrap gap-2">
												<button
													type="button"
													onClick={() => setChoice(key, "upload")}
													className={`text-xs px-3 py-1.5 rounded-lg border ${
														slot.choice === "upload"
															? "border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
															: "border-zinc-200 dark:border-zinc-700"
													}`}
												>
													Upload file
												</button>
												<button
													type="button"
													onClick={() => setChoice(key, "apply")}
													className={`text-xs px-3 py-1.5 rounded-lg border ${
														slot.choice === "apply"
															? "border-violet-300 bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
															: "border-zinc-200 dark:border-zinc-700"
													}`}
												>
													Apply for this document
												</button>
											</div>

											{slot.choice === "upload" && (
												<div className="mt-3 space-y-2">
													{slot.existingStoragePath && !slot.file && (
														<div className="text-xs text-zinc-600 dark:text-zinc-400">
															On file: <span className="font-medium">{slot.existingFileName ?? "Uploaded document"}</span>
														</div>
													)}
													<input
														type="file"
														accept="image/jpeg,image/jpg,.jpg,.jpeg,application/pdf,.pdf"
														onChange={(e) => onReqFile(key, e)}
														className="block w-full text-xs text-zinc-700 dark:text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-blue-700"
													/>
													{reqFileErrors[key] && <p className="text-xs text-red-600">{reqFileErrors[key]}</p>}
													{slot.file && (
														<div className="flex items-center justify-between gap-2 text-xs">
															<span>
																New: {slot.file.name} ({Math.ceil(slot.file.size / 1024)} KB)
															</span>
															<button type="button" onClick={() => clearReqFile(key)} className="text-red-600 hover:underline">
																Clear
															</button>
														</div>
													)}
												</div>
											)}

											{slot.choice === "apply" && (
												<div className="mt-3">
													<label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
														Optional note (e.g. what you’re missing or questions for our team)
													</label>
													<textarea
														value={slot.applyNotes}
														onChange={(e) =>
															setReqSlots((prev) => ({
																...prev,
																[key]: { ...prev[key], applyNotes: e.target.value },
															}))
														}
														rows={2}
														className="w-full px-3 py-2 text-sm border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
														placeholder="We’ll use this to follow up on your application for this document."
													/>
												</div>
											)}
										</div>
									);
								})}
							</div>

							<div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Company name *</label>
									<input
										value={companyName}
										onChange={(e) => setCompanyName(e.target.value)}
										className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
										placeholder="Your company legal name"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Industry</label>
									<input
										value={industry}
										onChange={(e) => setIndustry(e.target.value)}
										className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
										placeholder="e.g., Textiles"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Country</label>
									<input
										value={country}
										onChange={(e) => setCountry(e.target.value)}
										className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
										placeholder="e.g., India"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Website</label>
									<input
										value={website}
										onChange={(e) => setWebsite(e.target.value)}
										className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
										placeholder="e.g., https://example.com"
									/>
								</div>
								<div className="sm:col-span-2">
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Address</label>
									<textarea
										value={address}
										onChange={(e) => setAddress(e.target.value)}
										rows={3}
										className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
										placeholder="Street, city, state"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Tax ID</label>
									<input
										value={taxId}
										onChange={(e) => setTaxId(e.target.value)}
										className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
										placeholder="GST / VAT / tax number"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">Incorporation date</label>
									<input
										type="date"
										value={incorporationDate}
										onChange={(e) => setIncorporationDate(e.target.value)}
										className="w-full px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
									/>
								</div>
							</div>

							<div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
								<div className="text-xs text-zinc-600 dark:text-zinc-400">
									Submit saves company details and your document uploads / applications.
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
